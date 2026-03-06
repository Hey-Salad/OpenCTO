const http = require('http')
const fs = require('fs')
const os = require('os')
const path = require('path')
const { execFile } = require('child_process')
const { promisify } = require('util')

const port = Number(process.env.PORT || 4000)
const execFileAsync = promisify(execFile)
const DEFAULT_TIMEOUT_SECONDS = 600
const MAX_OUTPUT = 12000

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
    ;(async () => {
      let workspace = null
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

      const timeoutSeconds = Number.isFinite(Number(body.timeoutSeconds))
        ? Math.max(60, Math.min(1800, Number(body.timeoutSeconds)))
        : DEFAULT_TIMEOUT_SECONDS
      const startedAt = Date.now()
      const deadline = startedAt + timeoutSeconds * 1000
      const logs = [{ level: 'system', message: `Container accepted run ${body.runId}.` }]

      workspace = fs.mkdtempSync(path.join(os.tmpdir(), `codebase-run-${body.runId}-`))
      let cwd = workspace
      const repoDirName = repoNameFromUrl(String(body.repoUrl))
      const defaultRepoDir = path.join(workspace, repoDirName)

      for (const command of commands) {
        logs.push({ level: 'info', message: `$ ${command}` })
        const remainingMs = deadline - Date.now()
        if (remainingMs <= 0) {
          return sendJson(res, 200, {
            status: 'timed_out',
            errorMessage: `Run exceeded timeout of ${timeoutSeconds}s`,
            logs,
          })
        }

        const parts = splitCommand(command)
        const result = await execFileAsync(parts.file, parts.args, {
          cwd,
          timeout: remainingMs,
          maxBuffer: 1024 * 1024 * 8,
          env: {
            ...process.env,
            CI: '1',
          },
        })

        if (result.stdout) {
          logs.push(...toLogLines('info', result.stdout))
        }
        if (result.stderr) {
          logs.push(...toLogLines('warn', result.stderr))
        }

        if (parts.file === 'git' && parts.args[0] === 'clone' && fs.existsSync(defaultRepoDir)) {
          cwd = defaultRepoDir
        }
      }

      return sendJson(res, 200, {
        status: 'succeeded',
        logs,
      })
      } catch (error) {
        if (error && error.killed && error.signal === 'SIGTERM') {
          return sendJson(res, 200, {
            status: 'timed_out',
            errorMessage: 'Run timed out in container executor',
            logs: [{ level: 'error', message: 'Run timed out in container executor.' }],
          })
        }
        const message = error && error.message ? error.message : 'Execution failed'
        return sendJson(res, 200, {
          status: 'failed',
          errorMessage: message,
          logs: [{ level: 'error', message }],
        })
      } finally {
        if (workspace) {
          fs.rmSync(workspace, { recursive: true, force: true })
        }
      }
    })().catch(() => {
      return sendJson(res, 400, {
        status: 'failed',
        errorMessage: 'invalid_json',
        logs: [{ level: 'error', message: 'Unable to parse JSON body.' }],
      })
    })
  })
})

function splitCommand(command) {
  const parts = String(command).trim().split(/\s+/)
  const [file, ...args] = parts
  return { file, args }
}

function repoNameFromUrl(repoUrl) {
  const clean = String(repoUrl).replace(/\/+$/, '')
  const tail = clean.split('/').pop() || 'repo'
  return tail.endsWith('.git') ? tail.slice(0, -4) : tail
}

function toLogLines(level, raw) {
  return String(raw)
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 80)
    .map((line) => ({ level, message: line.slice(0, MAX_OUTPUT) }))
}

server.listen(port, '0.0.0.0', () => {
  console.log(`codebase-executor listening on ${port}`)
})
