# iOS App Roadmap

This document tracks the iOS application path for OpenCTO.

## Objective

Deliver a native iOS control surface (SwiftUI) for job execution, approvals, compliance status, and operational oversight.

## Phase I: Foundation

1. Project scaffold
- Create iOS app skeleton with SwiftUI navigation.
- Define environment config for API base URL and auth mode.

2. Auth baseline
- Implement sign-in shell.
- Add token storage strategy (Keychain).
- Add session bootstrap and sign-out flow.

3. Core views
- Jobs list view (status, timestamps, compliance badges).
- Job detail stream view (messages, step states, approval cards).

## Phase II: Operations

1. Approval actions
- Approve and deny dangerous steps.
- Add biometric confirmation for approval actions.

2. Compliance view
- List compliance checks with PASS/WARN/BLOCK states.
- Evidence export trigger and status indicator.

3. Billing view (read-focused)
- Current plan and usage display.
- Invoice list with open/download links.

## Phase III: Reliability and Release

1. Push notifications
- Approval-required notifications.
- Job failure and completion notifications.

2. Offline and retry behavior
- Cache recent jobs and stream snapshots.
- Retry queue for transient action failures.

3. Release readiness
- TestFlight build pipeline.
- App Store metadata, privacy policy, and compliance disclosures.

## API Dependencies

The iOS app relies on the same backend contracts used by `opencto-dashboard`:

- auth endpoints
- jobs and steps endpoints
- compliance endpoints
- billing endpoints

Reference mobile API package scaffold:
- `opencto/opencto-mobile-ios/opencto` (Swift Package, includes run approve/deny client methods)

## Mobile Wiring Policy

The iOS app should connect directly to the Cloudflare API worker, not to raw agent runtimes.

1. Required path
- iOS app -> `opencto-api-worker` -> queue/container/agent runtime.
- The worker remains the single trust boundary for auth, validation, and audit logging.

2. Forbidden path
- iOS app -> direct SSH/MQTT/container agent endpoints.
- This bypasses policy checks and increases prompt-injection/scam risk.

3. Security controls on mobile requests
- Use short-lived session tokens only.
- Require user confirmation (and optional biometrics) for high-risk actions.
- Treat all user text as untrusted and rely on backend guardrails for final enforcement.

## Definition of Done

- End-to-end login and job read path works on device.
- Approvals execute with backend confirmation.
- CI for iOS tests is green.
- Documentation updated in this file and root `ROADMAP.md`.
