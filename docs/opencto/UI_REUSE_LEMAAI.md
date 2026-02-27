# UI Reuse Plan - LemaAI

Source target: `https://github.com/chilu18/LemaAI`

## Objective

Reuse existing UI patterns/components from LemaAI to accelerate OpenCTO frontend delivery while applying OpenCTO brand and dark-mode constraints.

## Current Constraint

The repository could not be inspected from this environment due authentication/access limits, so this plan defines an extraction process and acceptance criteria.

## Reuse Strategy

1. Inventory reusable assets in LemaAI:
   - app shell and layout containers
   - navigation components
   - card/list/table primitives
   - forms, modals, and input controls
   - theme tokens and font setup
2. Map each reusable item into OpenCTO screens.
3. Replace visual tokens with OpenCTO brand tokens.
4. Enforce black background surfaces for authenticated app routes.
5. Remove emoji content and use icon components only.

## Mapping Matrix

- LemaAI shell -> OpenCTO app shell (top/left/center/right)
- LemaAI list cards -> Jobs list rows and compliance cards
- LemaAI modal system -> Human approval sheet/card
- LemaAI settings forms -> Right config panel controls

## Design Rules To Apply During Reuse

- Dark app surfaces: `#111111`, `#1a1a1a`, `#222222`
- Accent: `#ed4c4c`
- Typography: Grandstander + Figtree
- No emoji in UI labels, logs, or placeholders
- Icon set must be consistent across Mac, iOS, and web

## Extraction Checklist

- [ ] Identify component list in LemaAI
- [ ] Copy or reimplement compatible primitives
- [ ] Create OpenCTO component wrapper layer
- [ ] Add visual regression screenshots
- [ ] Validate accessibility contrast for dark theme
