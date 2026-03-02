import type { RequestContext } from './types'
import { BadRequestException, InternalServerException, jsonResponse } from './errors'

type UserProfileRow = {
  user_id: string
  workspace_id: string
  first_name: string
  last_name: string
  email: string
  phone: string | null
  github_username: string | null
  onboarding_completed: number
}

type WorkspaceRow = {
  id: string
  account_type: 'PERSONAL' | 'TEAM'
  name: string
  team_id: string | null
  org_id: string | null
}

type OnboardingMetaRow = {
  company_name: string
  team_size: string
  terms_accepted: number
}

let schemaReady = false

async function ensureSchema(ctx: RequestContext): Promise<void> {
  if (!ctx.env.DB) throw new InternalServerException('D1 database binding is not configured')
  if (schemaReady) return

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      owner_user_id TEXT NOT NULL,
      account_type TEXT NOT NULL,
      name TEXT NOT NULL,
      team_id TEXT,
      org_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS user_profiles (
      user_id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT,
      github_username TEXT,
      onboarding_completed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS workspace_members (
      workspace_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (workspace_id, user_id)
    )`,
  ).run()

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS workspace_projects (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL,
      name TEXT NOT NULL,
      provider TEXT NOT NULL,
      repo_owner TEXT,
      repo_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await ctx.env.DB.prepare(
    `CREATE TABLE IF NOT EXISTS onboarding_meta (
      user_id TEXT PRIMARY KEY,
      company_name TEXT NOT NULL,
      team_size TEXT NOT NULL,
      terms_accepted INTEGER NOT NULL DEFAULT 0,
      terms_accepted_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`,
  ).run()

  await ctx.env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_profiles_workspace ON user_profiles (workspace_id)',
  ).run()
  await ctx.env.DB.prepare(
    'CREATE INDEX IF NOT EXISTS idx_projects_workspace ON workspace_projects (workspace_id)',
  ).run()

  schemaReady = true
}

function nowIso(): string {
  return new Date().toISOString()
}

function cleanString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

function cleanTeamSize(value: unknown): '1' | '2-5' | '6-20' | '21-50' | '51+' | '' {
  const input = cleanString(value)
  if (input === '1' || input === '2-5' || input === '6-20' || input === '21-50' || input === '51+') {
    return input
  }
  return ''
}

function generateScopedId(prefix: 'org' | 'team'): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}`
}

// GET /api/v1/onboarding
export async function getOnboarding(ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)

  const profile = await ctx.env.DB.prepare(
    `SELECT user_id, workspace_id, first_name, last_name, email, phone, github_username, onboarding_completed
     FROM user_profiles
     WHERE user_id = ?`,
  ).bind(ctx.userId).first<UserProfileRow>()

  if (!profile) {
    return jsonResponse({
      completed: false,
      profile: {
        firstName: '',
        lastName: '',
        email: ctx.user.email,
        phone: '',
        githubUsername: ctx.user.email.split('@')[0] || '',
      },
      companyName: '',
      teamSize: '',
      termsAccepted: false,
    })
  }

  const workspace = await ctx.env.DB.prepare(
    `SELECT id, account_type, name, team_id, org_id
     FROM workspaces
     WHERE id = ?`,
  ).bind(profile.workspace_id).first<WorkspaceRow>()

  const meta = await ctx.env.DB.prepare(
    `SELECT company_name, team_size, terms_accepted
     FROM onboarding_meta
     WHERE user_id = ?`,
  ).bind(ctx.userId).first<OnboardingMetaRow>()

  return jsonResponse({
    completed: profile.onboarding_completed === 1 && (meta?.terms_accepted ?? 0) === 1,
    profile: {
      firstName: profile.first_name,
      lastName: profile.last_name,
      email: profile.email,
      phone: profile.phone ?? '',
      githubUsername: profile.github_username ?? '',
    },
    companyName: meta?.company_name ?? workspace?.name ?? '',
    teamSize: cleanTeamSize(meta?.team_size),
    termsAccepted: (meta?.terms_accepted ?? 0) === 1,
  })
}

// POST /api/v1/onboarding
export async function saveOnboarding(payload: Record<string, unknown>, ctx: RequestContext): Promise<Response> {
  await ensureSchema(ctx)

  const firstName = cleanString(payload.firstName)
  const lastName = cleanString(payload.lastName)
  const email = cleanString(payload.email)
  const phone = cleanString(payload.phone)
  const githubUsername = cleanString(payload.githubUsername)
  const companyName = cleanString(payload.companyName)
  const teamSize = cleanTeamSize(payload.teamSize)
  const acceptTerms = payload.acceptTerms === true
  const accountType = teamSize === '1' ? 'PERSONAL' : 'TEAM'

  if (!firstName || !lastName || !email || !companyName || !teamSize) {
    throw new BadRequestException('firstName, lastName, email, companyName, and teamSize are required')
  }
  if (!acceptTerms) {
    throw new BadRequestException('You must accept terms and conditions')
  }

  const current = nowIso()
  const existing = await ctx.env.DB.prepare(
    'SELECT workspace_id FROM user_profiles WHERE user_id = ?',
  ).bind(ctx.userId).first<{ workspace_id: string }>()
  const workspaceId = existing?.workspace_id ?? crypto.randomUUID()
  const existingWorkspace = await ctx.env.DB.prepare(
    'SELECT team_id, org_id FROM workspaces WHERE id = ?',
  ).bind(workspaceId).first<{ team_id: string | null; org_id: string | null }>()
  const teamId = cleanString(existingWorkspace?.team_id) || generateScopedId('team')
  const orgId = cleanString(existingWorkspace?.org_id) || generateScopedId('org')

  await ctx.env.DB.prepare(
    `INSERT INTO workspaces (id, owner_user_id, account_type, name, team_id, org_id, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       account_type = excluded.account_type,
       name = excluded.name,
       team_id = excluded.team_id,
       org_id = excluded.org_id,
       updated_at = excluded.updated_at`,
  ).bind(
    workspaceId,
    ctx.userId,
    accountType,
    companyName,
    teamId,
    orgId,
    current,
    current,
  ).run()

  await ctx.env.DB.prepare(
    `INSERT INTO user_profiles (user_id, workspace_id, first_name, last_name, email, phone, github_username, onboarding_completed, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       workspace_id = excluded.workspace_id,
       first_name = excluded.first_name,
       last_name = excluded.last_name,
       email = excluded.email,
       phone = excluded.phone,
       github_username = excluded.github_username,
       onboarding_completed = 1,
       updated_at = excluded.updated_at`,
  ).bind(
    ctx.userId,
    workspaceId,
    firstName,
    lastName,
    email,
    phone || null,
    githubUsername || null,
    current,
    current,
  ).run()

  await ctx.env.DB.prepare(
    `INSERT INTO workspace_members (workspace_id, user_id, role, created_at)
     VALUES (?, ?, 'owner', ?)
     ON CONFLICT(workspace_id, user_id) DO UPDATE SET role = excluded.role`,
  ).bind(workspaceId, ctx.userId, current).run()
  await ctx.env.DB.prepare(
    `INSERT INTO onboarding_meta (user_id, company_name, team_size, terms_accepted, terms_accepted_at, created_at, updated_at)
     VALUES (?, ?, ?, 1, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
      company_name = excluded.company_name,
      team_size = excluded.team_size,
      terms_accepted = 1,
      terms_accepted_at = excluded.terms_accepted_at,
      updated_at = excluded.updated_at`,
  ).bind(
    ctx.userId,
    companyName,
    teamSize,
    current,
    current,
    current,
  ).run()

  return await getOnboarding(ctx)
}
