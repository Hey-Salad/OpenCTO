import { describe, expect, it } from 'vitest'
import { getFlag, getFlagList, hasFlag, parseArgs } from '../src/args'

describe('args parser', () => {
  it('parses command and repeated flags', () => {
    const parsed = parseArgs([
      'run',
      '--repo-url', 'https://github.com/org/repo',
      '--command', 'npm test',
      '--command', 'npm run lint',
      '--wait',
    ])

    expect(parsed.command).toEqual(['run'])
    expect(getFlag(parsed, 'repo-url')).toBe('https://github.com/org/repo')
    expect(getFlagList(parsed, 'command')).toEqual(['npm test', 'npm run lint'])
    expect(hasFlag(parsed, 'wait')).toBe(true)
  })
})
