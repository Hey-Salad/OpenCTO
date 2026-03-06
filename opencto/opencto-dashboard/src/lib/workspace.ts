const WORKSPACE_KEY = 'opencto_workspace_id'

export function getWorkspaceId(): string {
  if (typeof window === 'undefined') return 'default'
  const value = window.localStorage.getItem(WORKSPACE_KEY)?.trim()
  return value || 'default'
}

export function setWorkspaceId(workspaceId: string): void {
  if (typeof window === 'undefined') return
  const value = workspaceId.trim() || 'default'
  window.localStorage.setItem(WORKSPACE_KEY, value)
}
