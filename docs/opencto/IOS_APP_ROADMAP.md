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

## Definition of Done

- End-to-end login and job read path works on device.
- Approvals execute with backend confirmation.
- CI for iOS tests is green.
- Documentation updated in this file and root `ROADMAP.md`.
