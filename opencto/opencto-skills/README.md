# OpenCTO Skills Pack

Repo-managed skill directory for Codex/OpenClaw.

## Included Skills

- `cto-playbook`

## Layout

- `opencto/opencto-skills/skills-manifest.json`
- `opencto/opencto-skills/cto-playbook/SKILL.md`
- `opencto/opencto-skills/cto-playbook/references/full-playbook.md`

## Install to Codex/OpenClaw

Use the installer script:

```bash
./opencto/scripts/install-opencto-skill.sh \
  --skill cto-playbook \
  --dest ~/.codex/skills
```

For OpenClaw (or any other runtime path):

```bash
./opencto/scripts/install-opencto-skill.sh \
  --skill cto-playbook \
  --dest ~/.openclaw/skills
```

## Security Scan (Recommended)

```bash
uvx snyk-agent-scan@latest --skills opencto/opencto-skills/cto-playbook/SKILL.md
```
