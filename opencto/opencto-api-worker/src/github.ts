import type { RequestContext, Env } from './types'
import { jsonResponse, InternalServerException } from './errors'

type GitHubConnectionRow = {
  user_id: string
  github_user_id: string
  github_login: string
  scope: string
  updated_at: string
}

type GitHubOrgApi = {
  id: number
  login: string
  avatar_url?: string
  description?: string | null
}

type GitHubRepoApi = {
  id: number
  name: string
  full_name: string
  private: boolean
  default_branch: string
  archived: boolean
  html_url: string
  pushed_at?: string
}

type GitHubPullApi = {
  id: number
  number: number
  title: string
  state: string
  html_url: string
  created_at: string
  updated_at: string
  merged_at: string | null
  closed_at: string | null
  user?: { login?: string }
  head?: { sha?: string }
  base?: { ref?: string }
}

type GitHubCheckRunApi = {
  id: number
  name: string
  status: string
  conclusion: string | null
  html_url?: string
  started_at?: string | null
  completed_at?: string | null
}

let schemaReady = false

function nowIso(): string {
  return new Date().toISOString()
}

async function ensureSchema(env: Env): Promise<void> {
  if (!env.DB) throw new InternalServerException('D1 database binding is not configured')
  if (schemaReady) return

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS github_connections (
      user_id TEXT PRIMARY KEY,
      github_user_id TEXT NOT NULL,
      github_login TEXT NOT NULL,
      access_token TEXT NOT NULL,
      scope TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS github_orgs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      github_org_id TEXT NOT NULL,
      login TEXT NOT NULL,
      avatar_url TEXT,
      description TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS github_repositories (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      org_login TEXT NOT NULL,
      github_repo_id TEXT NOT NULL,
      name TEXT NOT NULL,
      full_name TEXT NOT NULL,
      is_private INTEGER NOT NULL,
      default_branch TEXT,
      archived INTEGER NOT NULL,
      html_url TEXT NOT NULL,
      pushed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, github_repo_id)
    )`,
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS github_pull_requests (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      github_repo_id TEXT NOT NULL,
      github_pr_id TEXT NOT NULL,
      number INTEGER NOT NULL,
      title TEXT NOT NULL,
      state TEXT NOT NULL,
      author_login TEXT,
      head_sha TEXT,
      base_branch TEXT,
      html_url TEXT,
      created_at_ts TEXT NOT NULL,
      updated_at_ts TEXT NOT NULL,
      merged_at TEXT,
      closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, github_pr_id)
    )`,
  ).run()

  await env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS github_check_runs (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      github_repo_id TEXT NOT NULL,
      github_check_run_id TEXT NOT NULL,
      name TEXT NOT NULL,
      status TEXT NOT NULL,
      conclusion TEXT,
      html_url TEXT,
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE (user_id, github_check_run_id)
    )`,
  ).run()

  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_github_orgs_user ON github_orgs (user_id)').run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_github_repos_user_org ON github_repositories (user_id, org_login)').run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_github_prs_repo ON github_pull_requests (user_id, github_repo_id)').run()
  await env.DB.prepare('CREATE INDEX IF NOT EXISTS idx_github_checks_repo ON github_check_runs (user_id, github_repo_id)').run()

  schemaReady = true
}

export async function upsertGitHubConnection(
  env: Env,
  input: {
    userId: string
    githubUserId: string
    githubLogin: string
    accessToken: string
    scope: string
  },
): Promise<void> {
  await ensureSchema(env)
  const ts = nowIso()
  await env.DB.prepare(
    `INSERT INTO github_connections (user_id, github_user_id, github_login, access_token, scope, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
      github_user_id = excluded.github_user_id,
      github_login = excluded.github_login,
      access_token = excluded.access_token,
      scope = excluded.scope,
      updated_at = excluded.updated_at`,
  ).bind(input.userId, input.githubUserId, input.githubLogin, input.accessToken, input.scope, ts, ts).run()
}

async function getConnection(ctx: RequestContext): Promise<GitHubConnectionRow | null> {
  await ensureSchema(ctx.env)
  return await ctx.env.DB.prepare(
    `SELECT user_id, github_user_id, github_login, scope, updated_at
     FROM github_connections
     WHERE user_id = ?`,
  ).bind(ctx.userId).first<GitHubConnectionRow>()
}

async function getAccessToken(ctx: RequestContext): Promise<string | null> {
  await ensureSchema(ctx.env)
  const row = await ctx.env.DB.prepare(
    'SELECT access_token FROM github_connections WHERE user_id = ?',
  ).bind(ctx.userId).first<{ access_token: string }>()
  return row?.access_token ?? null
}

async function callGitHub(path: string, token: string): Promise<Response> {
  return await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'opencto-api-worker',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  })
}

export async function getGitHubStatus(ctx: RequestContext): Promise<Response> {
  const connection = await getConnection(ctx)
  return jsonResponse({
    connected: Boolean(connection),
    login: connection?.github_login ?? null,
    scope: connection?.scope ?? '',
    updatedAt: connection?.updated_at ?? null,
  })
}

export async function syncGitHub(ctx: RequestContext): Promise<Response> {
  const token = await getAccessToken(ctx)
  if (!token) {
    return jsonResponse({ error: 'GitHub is not connected for this user', code: 'NOT_CONNECTED' }, 400)
  }

  const orgsRes = await callGitHub('/user/orgs?per_page=20', token)
  const orgs = await orgsRes.json().catch(() => []) as GitHubOrgApi[]
  if (!orgsRes.ok) {
    return jsonResponse({ error: 'Failed to load GitHub orgs', code: 'UPSTREAM_ERROR', details: orgs }, 502)
  }

  const ts = nowIso()
  await ctx.env.DB.prepare('DELETE FROM github_orgs WHERE user_id = ?').bind(ctx.userId).run()

  let repoCount = 0
  let prCount = 0
  let checkRunCount = 0

  for (const org of orgs) {
    await ctx.env.DB.prepare(
      `INSERT INTO github_orgs (id, user_id, github_org_id, login, avatar_url, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(),
      ctx.userId,
      String(org.id),
      org.login,
      org.avatar_url ?? null,
      org.description ?? null,
      ts,
      ts,
    ).run()

    const reposRes = await callGitHub(`/orgs/${encodeURIComponent(org.login)}/repos?sort=updated&per_page=10`, token)
    const repos = await reposRes.json().catch(() => []) as GitHubRepoApi[]
    if (!reposRes.ok) continue

    for (const repo of repos) {
      repoCount += 1

      await ctx.env.DB.prepare(
        `INSERT INTO github_repositories (id, user_id, org_login, github_repo_id, name, full_name, is_private, default_branch, archived, html_url, pushed_at, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(user_id, github_repo_id) DO NOTHING`,
      ).bind(
        crypto.randomUUID(),
        ctx.userId,
        org.login,
        String(repo.id),
        repo.name,
        repo.full_name,
        repo.private ? 1 : 0,
        repo.default_branch,
        repo.archived ? 1 : 0,
        repo.html_url,
        repo.pushed_at ?? null,
        ts,
        ts,
      ).run().catch(async () => {
        await ctx.env.DB.prepare(
          `UPDATE github_repositories
           SET org_login = ?, name = ?, full_name = ?, is_private = ?, default_branch = ?, archived = ?, html_url = ?, pushed_at = ?, updated_at = ?
           WHERE user_id = ? AND github_repo_id = ?`,
        ).bind(
          org.login,
          repo.name,
          repo.full_name,
          repo.private ? 1 : 0,
          repo.default_branch,
          repo.archived ? 1 : 0,
          repo.html_url,
          repo.pushed_at ?? null,
          ts,
          ctx.userId,
          String(repo.id),
        ).run()
      })

      const pullsRes = await callGitHub(`/repos/${encodeURIComponent(org.login)}/${encodeURIComponent(repo.name)}/pulls?state=all&per_page=10`, token)
      const pulls = await pullsRes.json().catch(() => []) as GitHubPullApi[]
      if (pullsRes.ok) {
        for (const pr of pulls) {
          prCount += 1
          await ctx.env.DB.prepare(
            `INSERT INTO github_pull_requests (id, user_id, github_repo_id, github_pr_id, number, title, state, author_login, head_sha, base_branch, html_url, created_at_ts, updated_at_ts, merged_at, closed_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, github_pr_id) DO NOTHING`,
          ).bind(
            crypto.randomUUID(),
            ctx.userId,
            String(repo.id),
            String(pr.id),
            pr.number,
            pr.title,
            pr.state,
            pr.user?.login ?? null,
            pr.head?.sha ?? null,
            pr.base?.ref ?? null,
            pr.html_url,
            pr.created_at,
            pr.updated_at,
            pr.merged_at,
            pr.closed_at,
            ts,
            ts,
          ).run().catch(async () => {
            await ctx.env.DB.prepare(
              `UPDATE github_pull_requests
               SET number = ?, title = ?, state = ?, author_login = ?, head_sha = ?, base_branch = ?, html_url = ?, created_at_ts = ?, updated_at_ts = ?, merged_at = ?, closed_at = ?, updated_at = ?
               WHERE user_id = ? AND github_pr_id = ?`,
            ).bind(
              pr.number,
              pr.title,
              pr.state,
              pr.user?.login ?? null,
              pr.head?.sha ?? null,
              pr.base?.ref ?? null,
              pr.html_url,
              pr.created_at,
              pr.updated_at,
              pr.merged_at,
              pr.closed_at,
              ts,
              ctx.userId,
              String(pr.id),
            ).run()
          })
        }
      }

      const runsRes = await callGitHub(`/repos/${encodeURIComponent(org.login)}/${encodeURIComponent(repo.name)}/actions/runs?per_page=10`, token)
      const runsBody = await runsRes.json().catch(() => ({})) as { workflow_runs?: GitHubCheckRunApi[] }
      if (runsRes.ok) {
        for (const run of runsBody.workflow_runs ?? []) {
          checkRunCount += 1
          await ctx.env.DB.prepare(
            `INSERT INTO github_check_runs (id, user_id, github_repo_id, github_check_run_id, name, status, conclusion, html_url, started_at, completed_at, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON CONFLICT(user_id, github_check_run_id) DO NOTHING`,
          ).bind(
            crypto.randomUUID(),
            ctx.userId,
            String(repo.id),
            String(run.id),
            run.name,
            run.status,
            run.conclusion,
            run.html_url ?? null,
            run.started_at ?? null,
            run.completed_at ?? null,
            ts,
            ts,
          ).run().catch(async () => {
            await ctx.env.DB.prepare(
              `UPDATE github_check_runs
               SET name = ?, status = ?, conclusion = ?, html_url = ?, started_at = ?, completed_at = ?, updated_at = ?
               WHERE user_id = ? AND github_check_run_id = ?`,
            ).bind(
              run.name,
              run.status,
              run.conclusion,
              run.html_url ?? null,
              run.started_at ?? null,
              run.completed_at ?? null,
              ts,
              ctx.userId,
              String(run.id),
            ).run()
          })
        }
      }
    }
  }

  return jsonResponse({
    synced: true,
    orgCount: orgs.length,
    repoCount,
    prCount,
    checkRunCount,
    syncedAt: ts,
  })
}

export async function listGitHubOrgs(ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx.env)
  const res = await ctx.env.DB.prepare(
    `SELECT login, avatar_url, description, updated_at
     FROM github_orgs
     WHERE user_id = ?
     ORDER BY login ASC`,
  ).bind(ctx.userId).all<{ login: string; avatar_url: string | null; description: string | null; updated_at: string }>()

  return jsonResponse({ orgs: res.results ?? [] })
}

export async function listGitHubRepos(ctx: RequestContext, org: string): Promise<Response> {
  await ensureSchema(ctx.env)
  const orgFilter = (org || '').trim()
  const stmt = orgFilter
    ? ctx.env.DB.prepare(
      `SELECT org_login, name, full_name, is_private, default_branch, archived, html_url, pushed_at, updated_at
       FROM github_repositories
       WHERE user_id = ? AND org_login = ?
       ORDER BY updated_at DESC
       LIMIT 100`,
    ).bind(ctx.userId, orgFilter)
    : ctx.env.DB.prepare(
      `SELECT org_login, name, full_name, is_private, default_branch, archived, html_url, pushed_at, updated_at
       FROM github_repositories
       WHERE user_id = ?
       ORDER BY updated_at DESC
       LIMIT 100`,
    ).bind(ctx.userId)

  const res = await stmt.all<{
    org_login: string
    name: string
    full_name: string
    is_private: number
    default_branch: string | null
    archived: number
    html_url: string
    pushed_at: string | null
    updated_at: string
  }>()

  return jsonResponse({
    repos: (res.results ?? []).map((r) => ({
      org: r.org_login,
      name: r.name,
      fullName: r.full_name,
      private: r.is_private === 1,
      defaultBranch: r.default_branch,
      archived: r.archived === 1,
      htmlUrl: r.html_url,
      pushedAt: r.pushed_at,
      updatedAt: r.updated_at,
    })),
  })
}
