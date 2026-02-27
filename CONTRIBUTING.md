# Contributing

Thanks for contributing to HeySalad CTO.

## Workflow

1. Fork the repository.
2. Create a branch from `main`.
3. Make focused changes with clear commit messages.
4. Run local checks before pushing:
   - `./scripts/security/scan-secrets.sh`
   - Shell syntax checks for changed scripts
5. Open a pull request using the PR template.

## Pull request expectations

- Describe what changed and why.
- Link related issues.
- Include tests or verification steps.
- Do not commit credentials, tokens, or API keys.

## Release process

- Maintainers cut releases using tags like `v1.2.3`.
- A GitHub Release is generated automatically by workflow.

## Legal

By contributing, you agree your contributions are licensed under Apache-2.0.
Keep `NOTICE`, `ATTRIBUTION.md`, and `TRADEMARKS.md` intact in redistributions.
