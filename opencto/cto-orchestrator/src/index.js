import { loadConfig } from "./config.js";
import { fetchMetrics, deriveSignals } from "./monitor.js";
import { createOpenAI, triageIncident } from "./openai.js";
import { ensureIncidentIssue, commentOnIssue } from "./github.js";
import { loadState, saveState, saveStatus } from "./state.js";
import { sendTelegramAlert } from "./telegram.js";
import { startTelegramBot } from "./telegramBot.js";
import { recordAutonomyError, runAutonomyCycle } from "./autonomy.js";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function nowIso() {
  return new Date().toISOString();
}

function pushEvent(state, type, message, detail = {}) {
  const event = { timestamp: nowIso(), type, message, detail };
  const existing = Array.isArray(state.events) ? state.events : [];
  state.events = [event, ...existing].slice(0, 40);
}

function persist(cfg, state, partial = {}) {
  saveState(cfg.statePath, state);
  saveStatus(cfg.statusPath, buildStatus(cfg, state, partial));
}

function validateConfig(cfg) {
  if (!cfg.dryRun) {
    if (!cfg.openaiApiKey) {
      throw new Error("OPENAI_API_KEY is required when OPENCTO_DRY_RUN=false");
    }
    if (!cfg.githubToken || !cfg.githubOwner || !cfg.githubRepo) {
      throw new Error(
        "GITHUB_TOKEN, OPENCTO_GITHUB_OWNER, and OPENCTO_GITHUB_REPO are required when OPENCTO_DRY_RUN=false"
      );
    }
  }
}

function buildStatus(cfg, state, partial = {}) {
  const incidentKeys = Object.keys(state.incidents || {});
  const pendingApprovals = Object.values(state.approvals || {}).filter(
    (item) => item && item.status === "pending"
  ).length;
  const githubBase =
    cfg.githubOwner && cfg.githubRepo
      ? `https://github.com/${cfg.githubOwner}/${cfg.githubRepo}/issues/`
      : "";
  return {
    timestamp: nowIso(),
    dryRun: cfg.dryRun,
    monitorUrl: cfg.monitorUrl,
    githubTarget:
      cfg.githubOwner && cfg.githubRepo ? `${cfg.githubOwner}/${cfg.githubRepo}` : "unset",
    telegram: {
      enabled: cfg.telegramEnabled,
      configured: Boolean(cfg.telegramBotToken) && cfg.telegramChatIds.length > 0,
      chatCount: cfg.telegramChatIds.length,
      botMode: cfg.telegramBotMode,
    },
    pendingApprovals,
    autonomy: {
      enabled: cfg.autonomyEnabled,
      cycleSeconds: cfg.autonomyCycleSeconds,
      autoMerge: cfg.autonomyAutoMerge,
      mergeLabel: cfg.autonomyMergeLabel,
      lastRunAt: state.autonomy?.lastRunAt || null,
      lastError: state.autonomy?.lastError || null,
      cycles: state.autonomy?.cycles || 0,
      lastResults: state.autonomy?.lastResults || null,
    },
    incidentsTracked: incidentKeys.length,
    incidents: incidentKeys.slice(0, 20).map((key) => {
      const item = state.incidents[key] || {};
      return {
        key,
        title: item.title || null,
        issueNumber: item.issueNumber || null,
        issueUrl: item.issueNumber && githubBase ? `${githubBase}${item.issueNumber}` : null,
        lastPriority: item.lastPriority || null,
        lastSummary: item.lastSummary || null,
        lastSeenAt: item.lastSeenAt || null,
        updates: item.updates || 0,
      };
    }),
    events: (state.events || []).slice(0, 20),
    ...partial,
  };
}

async function handleIncident(cfg, ai, state, incident, metrics) {
  const existing = state.incidents[incident.key] || {};
  const now = Date.now();
  const lastCommentAtMs = existing.lastCommentAt ? Date.parse(existing.lastCommentAt) : 0;
  const cooldownMs = cfg.incidentCooldownSeconds * 1000;
  if (lastCommentAtMs && now - lastCommentAtMs < cooldownMs) {
    state.incidents[incident.key] = {
      ...existing,
      lastSeenAt: nowIso(),
      skippedByCooldown: (existing.skippedByCooldown || 0) + 1,
    };
    pushEvent(state, "cooldown_skip", `Skipped ${incident.key} due to cooldown`, {
      key: incident.key,
      severity: incident.severity,
    });
    return;
  }

  const triage = await triageIncident(
    ai,
    cfg.openaiModel,
    incident,
    metrics,
    cfg.maxActionsPerCycle
  );

  if (cfg.dryRun) {
    console.log(
      `[DRY_RUN] ${incident.key} priority=${triage.priority} summary=${triage.summary}`
    );
    state.incidents[incident.key] = {
      ...existing,
      title: incident.title,
      lastSeenAt: nowIso(),
      lastPriority: triage.priority,
      lastSummary: triage.summary,
      lastCommentAt: nowIso(),
      commentCount: (existing.commentCount || 0) + 1,
      updates: (existing.updates || 0) + 1,
    };
    pushEvent(state, "incident_dry_run", `Dry-run triage for ${incident.key}`, {
      key: incident.key,
      priority: triage.priority,
    });
    return;
  }

  if ((existing.commentCount || 0) >= cfg.maxIssueCommentsPerIncident) {
    state.incidents[incident.key] = {
      ...existing,
      lastSeenAt: nowIso(),
      skippedByCap: (existing.skippedByCap || 0) + 1,
    };
    pushEvent(state, "cap_skip", `Skipped ${incident.key} due to comment cap`, {
      key: incident.key,
    });
    return;
  }

  const issueNumber = await ensureIncidentIssue(cfg, incident, triage, existing);
  await commentOnIssue(
    cfg,
    issueNumber,
    [
      `### Automated Triage (${nowIso()})`,
      `Priority: **${triage.priority}**`,
      "",
      triage.summary,
      "",
      "Suggested actions:",
      ...triage.actions.slice(0, cfg.maxActionsPerCycle).map((a, i) => `${i + 1}. ${a.text}`),
    ].join("\n")
  );
  await sendTelegramAlert(cfg, incident, triage);

  state.incidents[incident.key] = {
    ...existing,
    title: incident.title,
    issueNumber,
    lastSeenAt: nowIso(),
    lastCommentAt: nowIso(),
    commentCount: (existing.commentCount || 0) + 1,
    lastPriority: triage.priority,
    lastSummary: triage.summary,
    updates: (existing.updates || 0) + 1,
  };
  pushEvent(state, "incident_updated", `Updated incident ${incident.key} -> issue #${issueNumber}`, {
    key: incident.key,
    issueNumber,
    priority: triage.priority,
  });
}

async function runLoop() {
  const cfg = loadConfig();
  validateConfig(cfg);
  const ai = createOpenAI(cfg.openaiApiKey);
  const state = loadState(cfg.statePath);
  let keepRunning = true;
  let botController = { stop: () => {} };
  let autonomyTimer = null;
  console.log(
    `OpenCTO orchestrator started. monitor=${cfg.monitorUrl} poll=${cfg.pollSeconds}s dryRun=${cfg.dryRun}`
  );
  pushEvent(state, "startup", "Orchestrator started", {
    dryRun: cfg.dryRun,
    githubTarget: cfg.githubOwner && cfg.githubRepo ? `${cfg.githubOwner}/${cfg.githubRepo}` : "unset",
  });
  persist(cfg, state, { lastCycle: "starting", error: null });

  process.on("SIGINT", () => {
    keepRunning = false;
    botController.stop();
    if (autonomyTimer) clearInterval(autonomyTimer);
  });
  process.on("SIGTERM", () => {
    keepRunning = false;
    botController.stop();
    if (autonomyTimer) clearInterval(autonomyTimer);
  });

  botController = await startTelegramBot({
    cfg,
    ai,
    state,
    onEvent: (type, message, detail) => {
      pushEvent(state, type, message, detail || {});
    },
    onStateChanged: () => {
      persist(cfg, state, { lastCycle: "ok", error: null });
    },
  });

  if (cfg.autonomyEnabled) {
    const run = async () => {
      try {
        const results = await runAutonomyCycle({
          cfg,
          ai,
          state,
          onEvent: (type, message, detail) => pushEvent(state, type, message, detail || {}),
        });
        pushEvent(state, "autonomy_cycle", "Autonomy cycle completed", results);
        persist(cfg, state, { lastCycle: "ok", error: null });
      } catch (error) {
        const msg = error?.message || String(error);
        recordAutonomyError(state, msg);
        pushEvent(state, "autonomy_error", msg, {});
        persist(cfg, state, { lastCycle: "error", error: msg });
      }
    };
    await run();
    autonomyTimer = setInterval(run, cfg.autonomyCycleSeconds * 1000);
  }

  while (keepRunning) {
    try {
      const metrics = await fetchMetrics(cfg.monitorUrl, cfg.httpTimeoutMs);
      const incidents = deriveSignals(metrics);
      if (incidents.length === 0) {
        console.log(`[${nowIso()}] healthy`);
      } else {
        pushEvent(state, "incident_detected", `Detected ${incidents.length} incident(s)`, {
          count: incidents.length,
          keys: incidents.map((item) => item.key),
        });
        for (const incident of incidents) {
          await handleIncident(cfg, ai, state, incident, metrics);
        }
      }
      persist(cfg, state, { lastCycle: "ok", error: null });
    } catch (error) {
      const message = error?.message || String(error);
      console.error(`[${nowIso()}] orchestrator error:`, message);
      pushEvent(state, "error", "Cycle failed", { message });
      persist(cfg, state, { lastCycle: "error", error: message });
    }
    await sleep(cfg.pollSeconds * 1000);
  }
  persist(cfg, state, { lastCycle: "stopped", error: null });
  console.log("OpenCTO orchestrator exited cleanly.");
}

runLoop().catch((error) => {
  console.error("fatal orchestrator error", error);
  process.exit(1);
});
