# opencto (iOS client)

Native Swift package for OpenCTO mobile approval flows.

Current scope is focused on approving or denying dangerous codebase runs from iOS/macOS clients.

## Implemented API Methods

- `OpenCTOClient.approveRun(runId:note:)`
- `OpenCTOClient.denyRun(runId:note:)`

These map to backend endpoints:

- `POST /api/v1/codebase/runs/:id/approve`
- `POST /api/v1/codebase/runs/:id/deny`

## Swift Package Details

- Package name: `opencto`
- Platforms:
  - iOS 16+
  - macOS 13+

## Add Dependency

Use Swift Package Manager and add this local package path or repository path containing `opencto/opencto-mobile-ios/opencto`.

## Quick Usage

```swift
import Foundation
import opencto

let tokenProvider = StaticBearerTokenProvider(token: "<session-token>")
let client = OpenCTOClient(
    baseURL: URL(string: "https://api.opencto.works")!,
    tokenProvider: tokenProvider
)

let approved = try await client.approveRun(runId: "run_123", note: "Approved on mobile")
let denied = try await client.denyRun(runId: "run_456", note: "Denied on mobile")
```

## Authentication Model

`OpenCTOClient` requires an `OpenCTOAuthTokenProvider`.

Use:

- `StaticBearerTokenProvider` for quick testing
- custom provider implementation for production token refresh/session handoff

## Production Guidance

- Never embed long-lived API keys in app binaries.
- Use short-lived backend-issued session tokens.
- Add biometric confirmation before approve/deny actions.
- Log approval actions server-side for auditability.

## Error Handling Expectations

Client calls can fail on:

- expired/invalid session token
- missing run ID or run state conflicts
- backend/network errors

Treat approve/deny calls as privileged actions and display explicit user confirmation on failure.

## How-To Guides

### How to add this package to an app target

1. Open your Xcode project.
2. Add package dependency pointing to repository/path containing `opencto/opencto-mobile-ios/opencto`.
3. Link product `opencto` to your app target.
4. Import with `import opencto`.

### How to wire token provisioning

1. Use `StaticBearerTokenProvider` for development only.
2. Implement `OpenCTOAuthTokenProvider` for production token refresh logic.
3. Pass provider when constructing `OpenCTOClient`.

### How to add a secure approval UI flow

1. Require explicit user confirmation before approve/deny actions.
2. Gate approval actions behind biometric check in-app.
3. Call `approveRun` or `denyRun`.
4. Show backend response status and log action metadata for auditing.

## References (Chicago 17th, Bibliography)

Apple. n.d. "Swift Packages." Apple Developer Documentation. Accessed March 6, 2026. https://developer.apple.com/documentation/swift_packages.

Swift.org. n.d. "Swift Package Manager." Accessed March 6, 2026. https://www.swift.org/documentation/package-manager/.

OWASP Foundation. n.d. "Secrets Management Cheat Sheet." Accessed March 6, 2026. https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html.
