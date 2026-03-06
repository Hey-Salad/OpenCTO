# OpenCTO Package Release Runbook

This runbook is for shipping:

- `@heysalad/opencto`
- `@heysalad/opencto-cli`

## Preconditions

1. Work on your release branch (never `main` directly).
2. `opencto/opencto-sdk-js` and `opencto/opencto-cli` must be committed and clean.
3. npm auth must be active on this machine:
   - `npm whoami`

## One-command release

From repository root:

```bash
./opencto/scripts/release-opencto-packages.sh
```

What it does:

1. Verifies npm auth.
2. Runs `lint`, `test`, `build` for SDK.
3. Publishes `@heysalad/opencto`.
4. Runs `lint`, `test`, `build` for CLI.
5. Publishes `@heysalad/opencto-cli`.

## Manual fallback

If you want step-by-step control:

```bash
cd opencto/opencto-sdk-js
npm run lint && npm run test && npm run build
npm publish --access public

cd ../opencto-cli
npm run lint && npm run test && npm run build
npm publish --access public
```

## Post-release verification

```bash
npm view @heysalad/opencto version
npm view @heysalad/opencto-cli version
```

## Notes

- `@heysalad/opencto-cli` depends on `@heysalad/opencto`, so publish SDK first.
- If npm returns `ENEEDAUTH`, run `npm login` and retry.
