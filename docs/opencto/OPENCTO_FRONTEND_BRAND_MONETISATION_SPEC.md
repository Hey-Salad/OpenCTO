# @heysalad/cto - OpenCTO Frontend, Brand and Monetisation Spec

Version: v0.4
Date: February 2026
Domain target: opencto.works

## 1. Brand System

### 1.1 Colours

- Primary: Cherry Red `#ed4c4c`
- Secondary: Peach `#faa09a`
- Tertiary: Light Peach `#ffd0cd`
- Base: White `#ffffff`

Dark surfaces:

- Background: `#111111`
- Surface: `#1a1a1a`
- Surface 2: `#222222`
- Border: `#2a2a2a`
- Muted text: `#888888`
- Body text: `#f0f0f0`

Semantic:

- Success: `#22c55e`
- Warning: `#f59e0b`
- Error: `#ed4c4c`
- Info: `#faa09a`

### 1.2 Usage Rules

- Primary CTA: Cherry Red background, white text.
- Active nav: 3px Cherry Red left border plus subtle Light Peach tint.
- Risk states: PASS green, WARN amber, BLOCK Cherry Red.
- Human approval cards: Peach left accent border.
- Links: Peach.

### 1.3 Typography

- Display and headings: Grandstander
- Body and labels: Figtree
- Code: JetBrains Mono or Courier New

## 2. Platform Surfaces

### 2.1 Mac app (dark mode only in v1)

Three-column layout:

- Left sidebar: 215px
- Center stream: flexible
- Right config: 290px

Global background and panels use black/dark surface tokens.

### 2.2 iOS app

Five-tab layout:

- Jobs
- Voice
- Compliance
- Metrics
- Settings

Dark background surfaces and Cherry Red active state.

### 2.3 Web (opencto.works)

- Marketing site: light mode allowed
- Authenticated app (`app.opencto.works`): dark mode default
- Docs page and pricing page included in initial surface scope

## 3. Stripe Billing Model

Plans:

- Starter (trial/free)
- Developer
- Team
- Pro
- Enterprise

Codex usage is metered as plan overage after included credit.

Required webhook processing events:

- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.payment_succeeded`
- `invoice.payment_failed`
- `checkout.session.completed`

## 4. Domain and Infra

Domain flow:

- Buy `opencto.works` (Namecheap)
- Move DNS to Cloudflare
- Configure `opencto.works`, `app.opencto.works`, `api.opencto.works`

Suggested Cloudflare services:

- Pages: marketing/web app
- Workers: API
- R2: artifacts and evidence bundles
- KV: cache/session primitives
- Access: admin route hardening

## 5. Component Standards

- Buttons: primary, secondary, ghost, danger, outline-danger
- Badges: PASS, WARN, BLOCK, RUNNING, PENDING
- Toasts: semantic left border and dark surfaces
- Approval card: explicit risk class, tool name, required approver actions

## 6. UI Constraints For This Build

- No emoji in product UI.
- Icons only.
- Black background default for app surfaces.
