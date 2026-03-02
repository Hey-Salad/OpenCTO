import { getApiBaseUrl } from '../config/apiBase'
import { getAuthHeaders } from '../lib/authToken'
import { normalizeApiError, safeFetchJson } from '../lib/safeError'

const API_BASE = `${getApiBaseUrl()}/api/v1`

export interface GitHubConnectionStatus {
  connected: boolean
  login: string | null
  scope: string
  updatedAt: string | null
}

export interface GitHubSyncResult {
  synced: boolean
  orgCount: number
  repoCount: number
  prCount: number
  checkRunCount: number
  syncedAt: string
}

export interface GitHubOrgSummary {
  login: string
  avatar_url: string | null
  description: string | null
  updated_at: string
}

export interface GitHubRepoSummary {
  org: string
  name: string
  fullName: string
  private: boolean
  defaultBranch: string | null
  archived: boolean
  htmlUrl: string
  pushedAt: string | null
  updatedAt: string
}

export async function getGitHubStatus(): Promise<GitHubConnectionStatus> {
  try {
    return await safeFetchJson<GitHubConnectionStatus>(
      `${API_BASE}/github/status`,
      { headers: getAuthHeaders() },
      'Failed to load GitHub connection status',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load GitHub connection status')
  }
}

export async function syncGitHubData(): Promise<GitHubSyncResult> {
  try {
    return await safeFetchJson<GitHubSyncResult>(
      `${API_BASE}/github/sync`,
      {
        method: 'POST',
        headers: getAuthHeaders(),
      },
      'Failed to sync GitHub data',
    )
  } catch (error) {
    throw normalizeApiError(error, 'Failed to sync GitHub data')
  }
}

export async function listGitHubOrgs(): Promise<GitHubOrgSummary[]> {
  try {
    const response = await safeFetchJson<{ orgs: GitHubOrgSummary[] }>(
      `${API_BASE}/github/orgs`,
      { headers: getAuthHeaders() },
      'Failed to load GitHub organizations',
    )
    return response.orgs ?? []
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load GitHub organizations')
  }
}

export async function listGitHubRepos(org?: string): Promise<GitHubRepoSummary[]> {
  const url = new URL(`${API_BASE}/github/repos`)
  if (org) url.searchParams.set('org', org)
  try {
    const response = await safeFetchJson<{ repos: GitHubRepoSummary[] }>(
      url.toString(),
      { headers: getAuthHeaders() },
      'Failed to load GitHub repositories',
    )
    return response.repos ?? []
  } catch (error) {
    throw normalizeApiError(error, 'Failed to load GitHub repositories')
  }
}
