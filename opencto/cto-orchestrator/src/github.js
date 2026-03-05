const GH_BASE = "https://api.github.com";

function ghHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "Content-Type": "application/json",
    "User-Agent": "opencto-cto-orchestrator",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

async function ghRequest(cfg, method, path, body) {
  const response = await fetch(`${GH_BASE}${path}`, {
    method,
    headers: ghHeaders(cfg.githubToken),
    signal: AbortSignal.timeout(cfg.httpTimeoutMs),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`GitHub API error (${response.status}) on ${path}: ${text}`);
  }
  return response;
}

async function findOpenIncidentIssue(cfg, incidentKey) {
  const response = await ghRequest(
    cfg,
    "GET",
    `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues?state=open&per_page=100&labels=${encodeURIComponent(
      cfg.issueLabels.join(",")
    )}`
  );
  const issues = await response.json();
  const marker = `Incident key: \`${incidentKey}\``;
  return issues.find((issue) => typeof issue.body === "string" && issue.body.includes(marker));
}

export async function ensureIncidentIssue(cfg, incident, triage, stateEntry) {
  if (stateEntry?.issueNumber) {
    return stateEntry.issueNumber;
  }

  const existing = await findOpenIncidentIssue(cfg, incident.key);
  if (existing?.number) {
    return existing.number;
  }

  const title = `[opencto][${incident.severity}] ${incident.title}`;
  const body = [
    `Incident key: \`${incident.key}\``,
    "",
    `Summary: ${triage.summary}`,
    "",
    `Details: ${incident.detail}`,
    "",
    "This issue is managed by opencto-cto-orchestrator.",
  ].join("\n");

  const response = await ghRequest(cfg, "POST", `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues`, {
    title,
    body,
    labels: cfg.issueLabels,
  });
  const created = await response.json();
  return created.number;
}

export async function commentOnIssue(cfg, issueNumber, text) {
  await ghRequest(
    cfg,
    "POST",
    `/repos/${cfg.githubOwner}/${cfg.githubRepo}/issues/${issueNumber}/comments`,
    { body: text }
  );
}
