export class Container {
  defaultPort?: number
  sleepAfter?: string
}

export function getContainer(_binding: unknown, _instanceId: string): { fetch: typeof fetch } {
  return {
    async fetch(): Promise<Response> {
      return new Response(JSON.stringify({
        status: 'failed',
        errorMessage: 'Mock container fetch not implemented',
        logs: [{ level: 'error', message: 'Mock container fetch not implemented' }],
      }), {
        status: 501,
        headers: { 'content-type': 'application/json' },
      })
    },
  }
}
