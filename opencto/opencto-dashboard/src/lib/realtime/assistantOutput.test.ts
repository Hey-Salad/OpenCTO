import { parseAssistantOutput, sanitizeAssistantNarration } from './assistantOutput'

describe('assistant output parser', () => {
  test('parses speech, code, command, and output blocks', () => {
    const text = [
      'I prepared a quick implementation.',
      '```ts',
      'const value = 42',
      '```',
      '$ npm run test',
      'OUTPUT:',
      'PASS src/example.test.ts',
    ].join('\n')

    const blocks = parseAssistantOutput(text)
    expect(blocks[0]).toMatchObject({ kind: 'speech' })
    expect(blocks.some((b) => b.kind === 'code' && b.text.includes('const value = 42'))).toBe(true)
    expect(blocks.some((b) => b.kind === 'command' && b.text === 'npm run test')).toBe(true)
    expect(blocks.some((b) => b.kind === 'output' && b.text.includes('PASS'))).toBe(true)
  })

  test('adds speech summary when only technical content is present', () => {
    const blocks = parseAssistantOutput('```bash\necho hello\n```\n$ echo hello')
    expect(blocks[0]).toMatchObject({
      kind: 'speech',
      text: "I've prepared code and command output in the workspace.",
    })
  })

  test('sanitizes internal preamble narration', () => {
    const cleaned = sanitizeAssistantNarration(`
**Initiating Conversation Response** I am working on the tone and format.
Hello, I can help with that.
`.trim())
    expect(cleaned).toBe('Hello, I can help with that.')
  })

  test('keeps transcript speech separated from technical artifacts', () => {
    const text = [
      'Here is what I changed.',
      '',
      '1. Update the API endpoint',
      '2. Run tests',
      '',
      '$ npm run test',
      'OUTPUT:',
      'PASS src/realtime.test.ts',
      '',
      '```python',
      'print("ok")',
      '```',
    ].join('\n')

    const blocks = parseAssistantOutput(text)
    expect(blocks.some((b) => b.kind === 'speech' && b.text.includes('Here is what I changed.'))).toBe(true)
    expect(blocks.some((b) => b.kind === 'plan' && b.text.includes('Update the API endpoint'))).toBe(true)
    expect(blocks.some((b) => b.kind === 'command' && b.text === 'npm run test')).toBe(true)
    expect(blocks.some((b) => b.kind === 'output' && b.text.includes('PASS src/realtime.test.ts'))).toBe(true)
    expect(blocks.some((b) => b.kind === 'code' && b.text.includes('print("ok")'))).toBe(true)
  })
})
