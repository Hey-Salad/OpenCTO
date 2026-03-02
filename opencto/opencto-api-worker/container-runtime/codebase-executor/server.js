const http = require('http')

const port = Number(process.env.PORT || 4000)

function sendJson(res, status, body) {
  res.statusCode = status
  res.setHeader('content-type', 'application/json')
  res.end(JSON.stringify(body))
}

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/execute') {
    return sendJson(res, 404, { error: 'not_found' })
  }

  let raw = ''
  req.on('data', (chunk) => {
    raw += chunk
  })

  req.on('end', () => {
    try {
      const body = JSON.parse(raw || '{}')
      const commands = Array.isArray(body.commands) ? body.commands.filter((v) => typeof v === 'string') : []
      if (!body.runId || !body.repoUrl || commands.length === 0) {
        return sendJson(res, 400, {
          status: 'failed',
          errorMessage: 'runId, repoUrl, and commands are required',
          logs: [
            { level: 'error', message: 'Invalid execution payload received by container runtime.' },
          ],
        })
      }

      const logs = [
        { level: 'system', message: `Container accepted run ${body.runId}.` },
        ...commands.map((command) => ({ level: 'info', message: `[stub] command received: ${command}` })),
      ]

      return sendJson(res, 200, {
        status: 'succeeded',
        logs,
      })
    } catch {
      return sendJson(res, 400, {
        status: 'failed',
        errorMessage: 'invalid_json',
        logs: [{ level: 'error', message: 'Unable to parse JSON body.' }],
      })
    }
  })
})

server.listen(port, '0.0.0.0', () => {
  console.log(`codebase-executor listening on ${port}`)
})
