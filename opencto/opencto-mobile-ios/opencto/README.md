# opencto (iOS client)

Native Swift client package for OpenCTO mobile integrations.

## What is implemented

- `OpenCTOClient.approveRun(runId:note:)`
- `OpenCTOClient.denyRun(runId:note:)`

These map to:

- `POST /api/v1/codebase/runs/:id/approve`
- `POST /api/v1/codebase/runs/:id/deny`

## Quick usage

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

## Security notes

- Do not embed permanent API keys in the app binary.
- Use short-lived backend-issued session tokens.
- Keep biometric confirmation in the app flow before calling approve/deny for dangerous actions.
