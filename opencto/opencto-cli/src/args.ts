export interface ParsedArgs {
  command: string[]
  flags: Record<string, string | boolean | string[]>
}

export function parseArgs(argv: string[]): ParsedArgs {
  const command: string[] = []
  const flags: Record<string, string | boolean | string[]> = {}

  let i = 0
  while (i < argv.length) {
    const part = argv[i]
    if (!part.startsWith('--')) {
      command.push(part)
      i += 1
      continue
    }

    const key = part.slice(2)
    const next = argv[i + 1]
    if (!next || next.startsWith('--')) {
      pushFlag(flags, key, true)
      i += 1
      continue
    }

    pushFlag(flags, key, next)
    i += 2
  }

  return { command, flags }
}

export function getFlag(args: ParsedArgs, key: string): string | undefined {
  const value = args.flags[key]
  if (typeof value === 'string') return value
  return undefined
}

export function getFlagList(args: ParsedArgs, key: string): string[] {
  const value = args.flags[key]
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === 'string') as string[]
  }
  if (typeof value === 'string') return [value]
  return []
}

export function hasFlag(args: ParsedArgs, key: string): boolean {
  return args.flags[key] === true
}

function pushFlag(flags: Record<string, string | boolean | string[]>, key: string, value: string | boolean): void {
  const current = flags[key]
  if (current === undefined) {
    flags[key] = value
    return
  }
  if (Array.isArray(current)) {
    current.push(String(value))
    return
  }
  flags[key] = [String(current), String(value)]
}
