# Security Policy

## Required controls

- Never commit real credentials or API keys.
- Store runtime secrets in Google Secret Manager or GitHub Actions Secrets.
- Rotate API keys immediately after any suspected exposure.

## Local guardrails

Install repository hooks:

```bash
./scripts/security/install-git-hooks.sh
```

This enables `.githooks/pre-push`, which runs `scripts/security/scan-secrets.sh`.

## CI guardrails

- `.github/workflows/ci-security.yml` runs:
  - gitleaks secret scan
  - basic smoke checks

## Incident response

1. Revoke exposed key(s).
2. Rotate replacements.
3. Rewrite git history if committed.
4. Re-scan repos and verify active keys.
