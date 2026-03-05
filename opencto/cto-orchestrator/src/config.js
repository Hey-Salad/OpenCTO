import path from "node:path";

function optionalInt(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function optionalList(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const values = raw
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  return values.length > 0 ? values : fallback;
}

function optionalBool(name, fallback) {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() !== "false";
}

export function loadConfig() {
  const dryRun = (process.env.OPENCTO_DRY_RUN || "true").toLowerCase() !== "false";
  return {
    monitorUrl: process.env.OPENCTO_MONITOR_URL || "http://127.0.0.1:8099/api/metrics",
    openaiApiKey: process.env.OPENAI_API_KEY || "",
    openaiModel: process.env.OPENCTO_OPENAI_MODEL || "gpt-4.1-mini",
    githubToken: process.env.GITHUB_TOKEN || "",
    githubOwner: process.env.OPENCTO_GITHUB_OWNER || "",
    githubRepo: process.env.OPENCTO_GITHUB_REPO || "",
    pollSeconds: optionalInt("OPENCTO_POLL_SECONDS", 30),
    maxActionsPerCycle: optionalInt("OPENCTO_MAX_ACTIONS", 3),
    incidentCooldownSeconds: optionalInt("OPENCTO_INCIDENT_COOLDOWN_SECONDS", 900),
    maxIssueCommentsPerIncident: optionalInt("OPENCTO_MAX_ISSUE_COMMENTS", 200),
    httpTimeoutMs: optionalInt("OPENCTO_HTTP_TIMEOUT_MS", 8000),
    issueLabels: optionalList("OPENCTO_ISSUE_LABELS", ["incident", "opencto", "automation"]),
    telegramEnabled: optionalBool("OPENCTO_TELEGRAM_ENABLED", true),
    telegramBotToken: process.env.OPENCTO_TELEGRAM_BOT_TOKEN || "",
    telegramChatIds: optionalList("OPENCTO_TELEGRAM_CHAT_IDS", []),
    telegramBotMode: optionalBool("OPENCTO_TELEGRAM_BOT_MODE", true),
    telegramPollSeconds: optionalInt("OPENCTO_TELEGRAM_POLL_SECONDS", 3),
    agentModel: process.env.OPENCTO_AGENT_MODEL || process.env.OPENCTO_OPENAI_MODEL || "gpt-4.1-mini",
    requireApprovals: optionalBool("OPENCTO_REQUIRE_APPROVALS", true),
    autonomyEnabled: optionalBool("OPENCTO_AUTONOMY_ENABLED", true),
    autonomyCycleSeconds: optionalInt("OPENCTO_AUTONOMY_CYCLE_SECONDS", 300),
    autonomyRoadmapPath:
      process.env.OPENCTO_AUTONOMY_ROADMAP_PATH ||
      "/home/hs-chilu/heysalad-ai-projects/CTO-AI/docs/opencto/IOS_APP_ROADMAP.md",
    autonomyMaxIssueCommentsPerCycle: optionalInt("OPENCTO_AUTONOMY_MAX_ISSUE_COMMENTS", 3),
    autonomyMaxPrReviewsPerCycle: optionalInt("OPENCTO_AUTONOMY_MAX_PR_REVIEWS", 3),
    autonomyAutoMerge: optionalBool("OPENCTO_AUTONOMY_AUTO_MERGE", false),
    autonomyMergeLabel: process.env.OPENCTO_AUTONOMY_MERGE_LABEL || "auto-merge",
    statusPath:
      process.env.OPENCTO_STATUS_PATH ||
      path.resolve(process.cwd(), ".data", "orchestrator-status.json"),
    dryRun,
    statePath:
      process.env.OPENCTO_STATE_PATH ||
      path.resolve(process.cwd(), ".data", "orchestrator-state.json"),
  };
}
