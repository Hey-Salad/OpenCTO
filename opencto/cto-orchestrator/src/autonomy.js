import fs from "node:fs";
import path from "node:path";

const GH_BASE = "https://api.github.com";

function nowIso() {
  return new Date().toISOString();
}

function dayAgoIso() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
}

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "opencto-autonomy-loop",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh(cfg, method, pathName, body) {
  const response = await fetch(`${GH_BASE}${pathName}`, {
    method,
    headers: ghHeaders(cfg.githubToken),
    signal: AbortSignal.timeout(cfg.httpTimeoutMs),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API ${method} ${pathName} failed (${response.status}): ${text}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function ensureAutonomyState(state) {
  if (!state.autonomy || typeof state.autonomy !== "object") {
    state.autonomy = {
      roadmapIssues: {},
      issueTouch: {},
      prReviewedSha: {},
      mergedPrs: [],
      cycles: 0,
      lastRunAt: null,
      lastError: null,
    };
  }
  return state.autonomy;
}

function readRoadmapSections(roadmapPath) {
  try {
    const file = path.resolve(roadmapPath);
    if (!fs.existsSync(file)) return [];
    const content = fs.readFileSync(file, "utf8");
    const lines = content.split("\n");
    const sections = [];
    for (const line of lines) {
      if (!line.startsWith("## ")) continue;
      const title = line.replace(/^##\s+/, "").trim();
      if (title.length < 4) continue;
      sections.push(title);
      if (sections.length >= 10) break;
    }
    return sections;
  } catch {
    return [];
  }
}

async function listOpenIssues(cfg) {
  return gh(cfg, "GET", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues?state=open&per_page=100`);
}

async function listOpenPrs(cfg) {
  return gh(cfg, "GET", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/pulls?state=open&per_page=100`);
}

async function issueComments(cfg, issueNumber) {
  return gh(
    cfg,
    "GET",
    `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues/${issueNumber}/comments?per_page=100`
  );
}

async function createIssue(cfg, title, body, labels) {
  return gh(cfg, "POST", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues`, {
    title,
    body,
    labels,
  });
}

async function commentIssue(cfg, issueNumber, body) {
  return gh(
    cfg,
    "POST",
    `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues/${issueNumber}/comments`,
    { body }
  );
}

async function prFiles(cfg, prNumber) {
  return gh(cfg, "GET", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/pulls/${prNumber}/files?per_page=100`);
}

async function checkRuns(cfg, sha) {
  return gh(
    cfg,
    "GET",
    `/repos/${cfg.githubOwner}/${cfg.githubRepo}/commits/${sha}/check-runs?per_page=100`
  );
}

async function mergePr(cfg, prNumber) {
  return gh(cfg, "PUT", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/pulls/${prNumber}/merge`, {
    merge_method: "squash",
  });
}

function hasLabel(pr, label) {
  return Array.isArray(pr.labels) && pr.labels.some((item) => item?.name === label);
}

function checksGreen(payload) {
  const runs = payload?.check_runs || [];
  if (runs.length === 0) return false;
  return runs.every((run) => run.status === "completed" && run.conclusion === "success");
}

async function summarizeIssue(ai, cfg, issue) {
  if (!ai) {
    return "Autonomous follow-up: define acceptance criteria, assign owner, and update implementation status.";
  }
  const response = await ai.responses.create({
    model: cfg.agentModel,
    input: [
      {
        role: "system",
        content:
          "You are OpenCTO autonomous scrum facilitator. Produce concise issue follow-up with decisions and next steps.",
      },
      {
        role: "user",
        content: `Issue:\nTitle: ${issue.title}\nBody: ${issue.body || ""}\n\nReturn 3-6 bullets with concrete execution next steps.`,
      },
    ],
    max_output_tokens: 300,
  });
  return response.output_text || "Autonomous follow-up generated.";
}

async function summarizePr(ai, cfg, pr, files) {
  const changed = files
    .slice(0, 20)
    .map((f) => `${f.filename} (+${f.additions}/-${f.deletions})`)
    .join("\n");

  if (!ai) {
    return {
      decision: "changes_requested",
      summary: "Model unavailable; manual review required.",
      concerns: ["Enable OPENAI_API_KEY for autonomous review quality."],
    };
  }

  const response = await ai.responses.create({
    model: cfg.agentModel,
    input: [
      {
        role: "system",
        content:
          "You are OpenCTO autonomous reviewer. Return strict JSON with decision=approve|changes_requested, summary string, concerns array of strings.",
      },
      {
        role: "user",
        content: `PR title: ${pr.title}\nPR body: ${pr.body || ""}\nChanged files:\n${changed}`,
      },
    ],
    max_output_tokens: 400,
  });

  try {
    const parsed = JSON.parse(response.output_text || "{}");
    return {
      decision: parsed.decision === "approve" ? "approve" : "changes_requested",
      summary: typeof parsed.summary === "string" ? parsed.summary : "Autonomous review complete.",
      concerns: Array.isArray(parsed.concerns) ? parsed.concerns.slice(0, 6) : [],
    };
  } catch {
    return {
      decision: "changes_requested",
      summary: "Autonomous review parse fallback: manual review recommended.",
      concerns: [],
    };
  }
}

async function syncRoadmapIssues(cfg, state, onEvent) {
  const auto = ensureAutonomyState(state);
  const sections = readRoadmapSections(cfg.autonomyRoadmapPath);
  if (sections.length === 0) return { created: 0, tracked: 0 };

  const openIssues = await listOpenIssues(cfg);
  let created = 0;

  for (const section of sections) {
    const title = `[Roadmap] ${section}`;
    const existing = openIssues.find((i) => i.title === title);
    if (existing) {
      auto.roadmapIssues[section] = existing.number;
      continue;
    }

    const issue = await createIssue(
      cfg,
      title,
      [
        `Autonomous roadmap tracking for: ${section}`,
        "",
        `Source roadmap: ${cfg.autonomyRoadmapPath}`,
        "",
        "Managed by OpenCTO autonomy loop.",
      ].join("\n"),
      ["opencto", "automation", "feature"]
    );
    auto.roadmapIssues[section] = issue.number;
    created += 1;
    onEvent?.("autonomy_issue_created", `Created roadmap issue: ${title}`, {
      issue: issue.number,
      section,
    });
  }

  return { created, tracked: sections.length };
}

async function driveIssueDiscussions(cfg, ai, state, onEvent) {
  const auto = ensureAutonomyState(state);
  const openIssues = await listOpenIssues(cfg);
  const threshold = dayAgoIso();
  let commented = 0;

  for (const issue of openIssues.slice(0, 20)) {
    if (issue.pull_request) continue;
    const last = auto.issueTouch[issue.number];
    if (last && last > threshold) continue;

    const summary = await summarizeIssue(ai, cfg, issue);
    const body = [
      `### OpenCTO Autonomous Discussion (${nowIso()})`,
      "",
      summary,
      "",
      "Decision policy: continue execution unless blocked by risk or missing access.",
    ].join("\n");

    await commentIssue(cfg, issue.number, body);
    auto.issueTouch[issue.number] = nowIso();
    commented += 1;
    onEvent?.("autonomy_issue_discussion", `Updated issue #${issue.number}`, {
      issue: issue.number,
    });

    if (commented >= cfg.autonomyMaxIssueCommentsPerCycle) break;
  }

  return { commented };
}

async function reviewAndMergePrs(cfg, ai, state, onEvent) {
  const auto = ensureAutonomyState(state);
  const prs = await listOpenPrs(cfg);
  let reviewed = 0;
  let merged = 0;

  for (const pr of prs.slice(0, 20)) {
    if (pr.draft) continue;
    if (auto.prReviewedSha[pr.number] === pr.head.sha) {
      continue;
    }

    const files = await prFiles(cfg, pr.number);
    const review = await summarizePr(ai, cfg, pr, files);
    const comment = [
      `### OpenCTO Autonomous PR Review (${nowIso()})`,
      `Decision: **${review.decision}**`,
      "",
      review.summary,
      "",
      ...(review.concerns.length > 0
        ? ["Concerns:", ...review.concerns.map((c, idx) => `${idx + 1}. ${c}`)]
        : ["Concerns: none identified."]),
    ].join("\n");

    await commentIssue(cfg, pr.number, comment);
    auto.prReviewedSha[pr.number] = pr.head.sha;
    reviewed += 1;
    onEvent?.("autonomy_pr_review", `Reviewed PR #${pr.number}`, {
      pr: pr.number,
      decision: review.decision,
    });

    if (
      cfg.autonomyAutoMerge &&
      review.decision === "approve" &&
      hasLabel(pr, cfg.autonomyMergeLabel)
    ) {
      const checks = await checkRuns(cfg, pr.head.sha);
      if (checksGreen(checks)) {
        await mergePr(cfg, pr.number);
        auto.mergedPrs = [pr.number, ...(auto.mergedPrs || [])].slice(0, 30);
        merged += 1;
        onEvent?.("autonomy_pr_merged", `Merged PR #${pr.number}`, { pr: pr.number });
      }
    }

    if (reviewed >= cfg.autonomyMaxPrReviewsPerCycle) break;
  }

  return { reviewed, merged };
}

export async function runAutonomyCycle({ cfg, ai, state, onEvent }) {
  const auto = ensureAutonomyState(state);
  const results = {
    roadmap: { created: 0, tracked: 0 },
    issues: { commented: 0 },
    prs: { reviewed: 0, merged: 0 },
  };

  results.roadmap = await syncRoadmapIssues(cfg, state, onEvent);
  results.issues = await driveIssueDiscussions(cfg, ai, state, onEvent);
  results.prs = await reviewAndMergePrs(cfg, ai, state, onEvent);

  auto.cycles += 1;
  auto.lastRunAt = nowIso();
  auto.lastError = null;
  auto.lastResults = results;
  return results;
}

export function recordAutonomyError(state, errorMessage) {
  const auto = ensureAutonomyState(state);
  auto.lastError = String(errorMessage || "unknown error");
  auto.lastRunAt = nowIso();
}
