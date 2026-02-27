// Tests for server-side entitlement enforcement

import { describe, it, expect } from 'vitest'
import { checkEntitlement, enforceEntitlement, getPlanLimits } from '../entitlements'
import { ForbiddenException } from '../errors'
import type { UsageSummary } from '../types'

describe('Entitlements', () => {
  describe('checkEntitlement', () => {
    it('should allow CREATE_JOB for STARTER plan under limit', () => {
      const usage: UsageSummary = {
        jobsUsed: 5,
        jobsLimit: 10,
        workersUsed: 1,
        workersLimit: 1,
        usersUsed: 1,
        usersLimit: 1,
        codexCreditUsedUsd: 5,
        codexCreditLimitUsd: 10,
      }

      const decision = checkEntitlement('CREATE_JOB', 'STARTER', usage)

      expect(decision.allowed).toBe(true)
      expect(decision.reason).toBeNull()
    })

    it('should block CREATE_JOB for STARTER plan at limit', () => {
      const usage: UsageSummary = {
        jobsUsed: 10,
        jobsLimit: 10,
        workersUsed: 1,
        workersLimit: 1,
        usersUsed: 1,
        usersLimit: 1,
        codexCreditUsedUsd: 10,
        codexCreditLimitUsd: 10,
      }

      const decision = checkEntitlement('CREATE_JOB', 'STARTER', usage)

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toContain('Job limit reached')
    })

    it('should warn when approaching job limit', () => {
      const usage: UsageSummary = {
        jobsUsed: 9, // 90% of 10
        jobsLimit: 10,
        workersUsed: 1,
        workersLimit: 1,
        usersUsed: 1,
        usersLimit: 1,
        codexCreditUsedUsd: 5,
        codexCreditLimitUsd: 10,
      }

      const decision = checkEntitlement('CREATE_JOB', 'STARTER', usage)

      expect(decision.allowed).toBe(true)
      expect(decision.warning).toContain('Approaching job limit')
    })

    it('should block APPROVE_DANGEROUS_STEP for STARTER plan', () => {
      const usage: UsageSummary = {
        jobsUsed: 0,
        jobsLimit: 10,
        workersUsed: 0,
        workersLimit: 1,
        usersUsed: 1,
        usersLimit: 1,
        codexCreditUsedUsd: 0,
        codexCreditLimitUsd: 10,
      }

      const decision = checkEntitlement('APPROVE_DANGEROUS_STEP', 'STARTER', usage)

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toContain('does not include dangerous step approvals')
    })

    it('should allow APPROVE_DANGEROUS_STEP for DEVELOPER plan', () => {
      const usage: UsageSummary = {
        jobsUsed: 0,
        jobsLimit: 100,
        workersUsed: 0,
        workersLimit: 3,
        usersUsed: 1,
        usersLimit: 3,
        codexCreditUsedUsd: 0,
        codexCreditLimitUsd: 50,
      }

      const decision = checkEntitlement('APPROVE_DANGEROUS_STEP', 'DEVELOPER', usage)

      expect(decision.allowed).toBe(true)
      expect(decision.reason).toBeNull()
    })

    it('should block EXPORT_EVIDENCE_PACKAGE for DEVELOPER plan', () => {
      const usage: UsageSummary = {
        jobsUsed: 0,
        jobsLimit: 100,
        workersUsed: 0,
        workersLimit: 3,
        usersUsed: 1,
        usersLimit: 3,
        codexCreditUsedUsd: 0,
        codexCreditLimitUsd: 50,
      }

      const decision = checkEntitlement('EXPORT_EVIDENCE_PACKAGE', 'DEVELOPER', usage)

      expect(decision.allowed).toBe(false)
      expect(decision.reason).toContain('does not include compliance evidence export')
    })

    it('should allow EXPORT_EVIDENCE_PACKAGE for TEAM plan', () => {
      const usage: UsageSummary = {
        jobsUsed: 0,
        jobsLimit: 500,
        workersUsed: 0,
        workersLimit: 10,
        usersUsed: 1,
        usersLimit: 10,
        codexCreditUsedUsd: 0,
        codexCreditLimitUsd: 200,
      }

      const decision = checkEntitlement('EXPORT_EVIDENCE_PACKAGE', 'TEAM', usage)

      expect(decision.allowed).toBe(true)
      expect(decision.reason).toBeNull()
    })

    it('should allow unlimited jobs for PRO plan', () => {
      const usage: UsageSummary = {
        jobsUsed: 10000, // Way over typical limits
        jobsLimit: null, // Unlimited
        workersUsed: 100,
        workersLimit: null,
        usersUsed: 20,
        usersLimit: 25,
        codexCreditUsedUsd: 500,
        codexCreditLimitUsd: 1000,
      }

      const decision = checkEntitlement('CREATE_JOB', 'PRO', usage)

      expect(decision.allowed).toBe(true)
      expect(decision.reason).toBeNull()
      expect(decision.warning).toBeNull() // No warning for unlimited
    })
  })

  describe('enforceEntitlement', () => {
    it('should not throw for allowed actions', () => {
      const usage: UsageSummary = {
        jobsUsed: 0,
        jobsLimit: 10,
        workersUsed: 0,
        workersLimit: 1,
        usersUsed: 1,
        usersLimit: 1,
        codexCreditUsedUsd: 0,
        codexCreditLimitUsd: 10,
      }

      expect(() => {
        enforceEntitlement('CREATE_JOB', 'STARTER', usage)
      }).not.toThrow()
    })

    it('should throw ForbiddenException for blocked actions', () => {
      const usage: UsageSummary = {
        jobsUsed: 0,
        jobsLimit: 10,
        workersUsed: 0,
        workersLimit: 1,
        usersUsed: 1,
        usersLimit: 1,
        codexCreditUsedUsd: 0,
        codexCreditLimitUsd: 10,
      }

      expect(() => {
        enforceEntitlement('APPROVE_DANGEROUS_STEP', 'STARTER', usage)
      }).toThrow(ForbiddenException)
    })
  })

  describe('getPlanLimits', () => {
    it('should return correct limits for STARTER plan', () => {
      const limits = getPlanLimits('STARTER')

      expect(limits).not.toBeNull()
      expect(limits?.jobsLimit).toBe(10)
      expect(limits?.workersLimit).toBe(1)
      expect(limits?.usersLimit).toBe(1)
      expect(limits?.codexCreditLimitUsd).toBe(10)
    })

    it('should return null limits for PRO plan unlimited features', () => {
      const limits = getPlanLimits('PRO')

      expect(limits).not.toBeNull()
      expect(limits?.jobsLimit).toBeNull() // Unlimited
      expect(limits?.workersLimit).toBeNull() // Unlimited
      expect(limits?.usersLimit).toBe(25)
    })

    it('should return null limits for ENTERPRISE plan', () => {
      const limits = getPlanLimits('ENTERPRISE')

      expect(limits).not.toBeNull()
      expect(limits?.jobsLimit).toBeNull()
      expect(limits?.workersLimit).toBeNull()
      expect(limits?.usersLimit).toBeNull()
      expect(limits?.codexCreditLimitUsd).toBeNull()
    })
  })
})
