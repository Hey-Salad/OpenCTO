export interface TopicBuilderOptions {
  workspaceId: string
  topicPrefix?: string
}

function stripTrailingSlashes(value: string): string {
  let end = value.length
  while (end > 0 && value.charCodeAt(end - 1) === 47) end -= 1
  return value.slice(0, end)
}

function root(opts: TopicBuilderOptions): string {
  const prefix = stripTrailingSlashes(opts.topicPrefix ?? 'opencto')
  return `${prefix}/workspace/${opts.workspaceId}`
}

export function topicTasksNew(opts: TopicBuilderOptions): string {
  return `${root(opts)}/tasks/new`
}

export function topicTasksAssigned(opts: TopicBuilderOptions): string {
  return `${root(opts)}/tasks/assigned`
}

export function topicTasksComplete(opts: TopicBuilderOptions): string {
  return `${root(opts)}/tasks/complete`
}

export function topicTasksFailed(opts: TopicBuilderOptions): string {
  return `${root(opts)}/tasks/failed`
}

export function topicRunsEvents(opts: TopicBuilderOptions): string {
  return `${root(opts)}/runs/events`
}

export function topicAgentsHeartbeat(opts: TopicBuilderOptions): string {
  return `${root(opts)}/agents/heartbeat`
}

export function topicWorkspaceWildcard(opts: TopicBuilderOptions): string {
  return `${root(opts)}/#`
}
