#!/usr/bin/env node
import { runCli } from './main'

runCli(process.argv.slice(2)).catch((error) => {
  const message = error instanceof Error ? error.message : String(error)
  console.error(`opencto: ${message}`)
  process.exitCode = 1
})
