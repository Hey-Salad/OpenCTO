import { describe, expect, it } from 'vitest'
import { getWorkflow, listWorkflows, renderCommandTemplates } from '../src/workflows/catalog'

describe('workflow catalog', () => {
  it('lists built-in workflows', () => {
    const workflows = listWorkflows()
    expect(workflows.length).toBeGreaterThan(0)
    expect(workflows.some((workflow) => workflow.id === 'engineering-ci')).toBe(true)
  })

  it('renders templates with variables', () => {
    const rendered = renderCommandTemplates(
      ['npm run {{script}}', 'echo {{message}}'],
      { script: 'test', message: 'ok' },
    )
    expect(rendered).toEqual(['npm run test', 'echo ok'])
  })

  it('throws when required variables are missing', () => {
    expect(() => renderCommandTemplates(['npm run {{script}}'], {})).toThrow('Missing workflow variable: script')
  })

  it('gets workflow by id', () => {
    const workflow = getWorkflow('engineering-ci')
    expect(workflow?.name).toBe('Engineering CI')
  })
})
