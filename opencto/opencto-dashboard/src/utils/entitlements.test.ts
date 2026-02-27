import { evaluateEntitlement } from './entitlements'
import type { EntitlementContext } from '../types/billing'

const starterContext: EntitlementContext = {
  planCode: 'STARTER',
  usage: {
    jobsUsed: 5,
    jobsLimit: 5,
    workersUsed: 1,
    workersLimit: 1,
    usersUsed: 1,
    usersLimit: 1,
  },
}

const developerNearLimit: EntitlementContext = {
  planCode: 'DEVELOPER',
  usage: {
    jobsUsed: 41,
    jobsLimit: 50,
    workersUsed: 1,
    workersLimit: 2,
    usersUsed: 1,
    usersLimit: 1,
  },
}

test('blocks job creation when limit reached', () => {
  const decision = evaluateEntitlement(starterContext, 'CREATE_JOB')
  expect(decision.allowed).toBe(false)
  expect(decision.reason).toContain('Upgrade plan')
})

test('warns near plan limit', () => {
  const decision = evaluateEntitlement(developerNearLimit, 'CREATE_JOB')
  expect(decision.allowed).toBe(true)
  expect(decision.warning).toContain('80 percent')
})

test('blocks dangerous approval on starter and allows on team', () => {
  const blocked = evaluateEntitlement(starterContext, 'APPROVE_DANGEROUS_STEP')
  const allowed = evaluateEntitlement({ ...starterContext, planCode: 'TEAM' }, 'APPROVE_DANGEROUS_STEP')

  expect(blocked.allowed).toBe(false)
  expect(allowed.allowed).toBe(true)
})
