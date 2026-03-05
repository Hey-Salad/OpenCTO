const GH_BASE = "https://api.github.com";

function headers(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "opencto-cto-orchestrator",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function gh(cfg, method, path, body) {
  const response = await fetch(`${GH_BASE}${path}`, {
    method,
    headers: headers(cfg.githubToken),
    signal: AbortSignal.timeout(cfg.httpTimeoutMs),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`GitHub API ${method} ${path} failed (${response.status}): ${raw}`);
  }
  if (response.status === 204) return null;
  return response.json();
}

function plusDaysIso(days) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  d.setUTCHours(23, 59, 0, 0);
  return d.toISOString();
}

async function ensureLabel(cfg, name, color, description) {
  try {
    await gh(cfg, "POST", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/labels`, {
      name,
      color,
      description,
    });
  } catch (error) {
    if (!String(error?.message || "").includes("422")) {
      throw error;
    }
  }
}

async function getOpenMilestones(cfg) {
  return gh(cfg, "GET", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/milestones?state=open&per_page=100`);
}

async function ensureMilestone(cfg, title, description, dueOn) {
  const open = await getOpenMilestones(cfg);
  const existing = open.find((m) => m.title === title);
  if (existing) return existing;
  return gh(cfg, "POST", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/milestones`, {
    title,
    description,
    due_on: dueOn,
  });
}

async function listOpenIssues(cfg) {
  return gh(cfg, "GET", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues?state=open&per_page=100`);
}

async function ensureIssue(cfg, title, body, labels, milestoneNumber) {
  const open = await listOpenIssues(cfg);
  const existing = open.find((i) => i.title === title);
  if (existing) return existing;
  return gh(cfg, "POST", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues`, {
    title,
    body,
    labels,
    milestone: milestoneNumber,
  });
}

function defaultTracks(version, goal) {
  return [
    {
      title: `[${version}] Agent Command Router + Approval UX hardening`,
      labels: ["opencto", "automation", "feature", "agents"],
      body: [
        "Goal:",
        goal,
        "",
        "Deliverables:",
        "- Improve intent routing precision and tool selection",
        "- Better approval UX (/approve, /deny, status summaries)",
        "- Add regression tests for agent command handling",
      ].join("\n"),
    },
    {
      title: `[${version}] Telegram agent release notes + changelog automation`,
      labels: ["opencto", "automation", "release", "agents"],
      body: [
        "Goal:",
        "Automate sprint summary and release notes for each agent release.",
        "",
        "Deliverables:",
        "- Auto-assemble notable changes from merged PRs",
        "- Publish release summary issue comment",
        "- Add release checklist template",
      ].join("\n"),
    },
    {
      title: `[${version}] Zero Trust auth verification and incident runbook`,
      labels: ["opencto", "security", "ops"],
      body: [
        "Goal:",
        "Lock down dashboard/API access and document runbook.",
        "",
        "Deliverables:",
        "- Access policy validation (email + OTP)",
        "- Failure mode checks and monitoring alerts",
        "- Runbook in docs/opencto",
      ].join("\n"),
    },
    {
      title: `[${version}] Mobile/OpenCTO endpoint parity validation`,
      labels: ["opencto", "mobile", "qa"],
      body: [
        "Goal:",
        "Verify mobile app paths against latest OpenCTO API and realtime events.",
        "",
        "Deliverables:",
        "- API contract checks",
        "- Smoke run on auth/chat/runs flows",
        "- Gap report and fix list",
      ].join("\n"),
    },
  ];
}

export async function kickoffReleaseTrain(cfg, options = {}) {
  const version = options.version || `opencto-agent-${new Date().toISOString().slice(0, 10)}`;
  const goal = options.goal || "Ship a reliable autonomous CTO + developer workflow with human approvals.";
  const dueDays = Number.isFinite(options.dueDays) ? options.dueDays : 7;

  await ensureLabel(cfg, "opencto", "1d76db", "OpenCTO platform work");
  await ensureLabel(cfg, "automation", "5319e7", "Agent automation");
  await ensureLabel(cfg, "agents", "0e8a16", "Agent runtime and tooling");
  await ensureLabel(cfg, "release", "fbca04", "Release management");
  await ensureLabel(cfg, "feature", "a2eeef", "Feature work");
  await ensureLabel(cfg, "ops", "d93f0b", "Operations work");
  await ensureLabel(cfg, "security", "b60205", "Security hardening");
  await ensureLabel(cfg, "mobile", "0052cc", "Mobile app work");
  await ensureLabel(cfg, "qa", "c2e0c6", "Quality assurance");

  const milestoneTitle = `OpenCTO ${version}`;
  const milestone = await ensureMilestone(
    cfg,
    milestoneTitle,
    `Agent-driven release train for ${version}.`,
    plusDaysIso(dueDays)
  );

  const tracks = defaultTracks(version, goal);
  const created = [];
  for (const item of tracks) {
    const issue = await ensureIssue(cfg, item.title, item.body, item.labels, milestone.number);
    created.push({ number: issue.number, title: issue.title, url: issue.html_url });
  }

  return {
    version,
    milestone: {
      number: milestone.number,
      title: milestone.title,
      url: milestone.html_url,
      due_on: milestone.due_on,
    },
    issues: created,
  };
}
