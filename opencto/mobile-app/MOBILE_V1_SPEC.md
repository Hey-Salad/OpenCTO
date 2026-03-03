# OpenCTO Mobile App Spec (MVP v1)

## 1. Product Objective
Build a lightweight mobile companion to the web app so users can:
1. Sign in.
2. Talk to OpenCTO in realtime voice.
3. Continue with text chat.
4. Monitor and cancel codebase runs.
5. View basic account/workspace info.

Primary objective:
- Ship a simple, stable, production-oriented iOS-first mobile app with core Autonomous CTO functionality and OpenAI-only realtime voice.

## 2. MVP Scope (In)
1. Authentication with existing OpenCTO backend.
2. Realtime voice session using OpenAI only.
3. Text chat in the same conversation screen.
4. Runs list and run detail with live/polling updates.
5. Cancel run action.
6. Basic account screen with sign out.
7. In-app account deletion initiation.
8. Error states, reconnect states, and loading states.

## 3. MVP Scope (Out)
1. Billing UI.
2. Passkey enrollment UI.
3. Multi-provider voice/model switching.
4. Full onboarding wizard.
5. Push notifications.
6. Advanced offline mode.
7. iPad-specific layouts.

## 4. Engineering Principles
1. DRY by default:
   - Shared UI primitives (`Button`, `Card`, `Badge`, `ListItem`, `EmptyState`, `ErrorState`).
   - Shared form/input components.
   - Shared API client and request helpers.
   - Shared error normalization.
   - Shared auth/session hooks.
   - Shared realtime session manager.
2. Keep components small, composable, and reusable.
3. Avoid duplicate logic between screens.
4. Prefer centralized domain modules over ad-hoc per-screen logic.
5. Keep dependencies minimal.
6. Prefer simple, production-oriented implementations over speculative abstractions.

## 5. Tech Stack
1. Expo, React Native, TypeScript.
2. EAS Build + EAS Submit.
3. Expo Router for navigation.
4. Secure token storage with `expo-secure-store`.
5. Networking via `fetch`.
6. Realtime transport compatible with React Native.
7. Audio capture/playback with Expo/native modules supported in EAS builds.
8. State management with React context + hooks.
9. iOS-first configuration and validation for initial release scope.

## 6. App Architecture
Tasks:
1. Create route structure:
   - `app/(auth)/login.tsx`
   - `app/(tabs)/chat.tsx`
   - `app/(tabs)/runs.tsx`
   - `app/run/[id].tsx`
   - `app/(tabs)/account.tsx`
2. Create reusable modules:
   - `src/api/*` (auth/chat/runs/realtime clients)
   - `src/realtime/*` (OpenAI realtime session manager)
   - `src/audio/*` (mic/session/audio handling)
   - `src/state/*` (auth/session/chat/run state)
   - `src/components/*` (shared reusable UI)
   - `src/hooks/*` (reusable business hooks)

## 7. Backend Integration
Base API:
- `https://api.opencto.works`

Tasks:
1. Integrate:
   - `GET /api/v1/auth/session`
   - `GET /api/v1/chats`
   - `GET /api/v1/chats/:id`
   - `POST /api/v1/chats/save`
   - `POST /api/v1/realtime/token`
   - `POST /api/v1/codebase/runs`
   - `GET /api/v1/codebase/runs/:id`
   - `GET /api/v1/codebase/runs/:id/events`
   - `GET /api/v1/codebase/runs/:id/events/stream`
   - `POST /api/v1/codebase/runs/:id/cancel`
   - `DELETE /api/v1/auth/account`
2. Standardize auth header injection:
   - `Authorization: Bearer <token>`
3. Centralize API error mapping and retry behavior.

## 8. Realtime Voice v1 (OpenAI-only)
Tasks:
1. Implement voice session flow:
   - Start voice session.
   - Request mic permission.
   - Request ephemeral token from `/api/v1/realtime/token`.
   - Open realtime connection.
   - Stream mic input.
   - Receive and render assistant/tool events.
2. Implement session state machine:
   - `idle`, `connecting`, `live`, `reconnecting`, `error`, `ended`.
3. Implement controls:
   - Start/Stop
   - Mute/Unmute
   - Live status/timer
4. Implement resilience:
   - Single auto-reconnect attempt.
   - Fallback to text mode if reconnect fails.
   - Token refresh handling for continued session.
   - Graceful interruption handling.

## 9. UI Requirements
### Chat Tab
Tasks:
1. Build reusable chat message list component.
2. Build unified message renderer for `USER | ASSISTANT | TOOL`.
3. Build text input composer.
4. Build reusable voice control bar and connection badge.
5. Support text and voice in one timeline.

### Runs Tab
Tasks:
1. Build reusable runs list item and status badge.
2. Build pull-to-refresh and empty/error states.
3. Navigate to run details on tap.

### Run Detail
Tasks:
1. Render run summary and status.
2. Render event log stream/poll updates.
3. Add cancel action for valid states.

### Account Tab
Tasks:
1. Render user/workspace summary cards.
2. Add sign out action.
3. Add account deletion initiation action.

## 10. Data Contracts
Tasks:
1. Define shared models:
   - `AuthSession`
   - `ChatMessage`
   - `CodebaseRun`
   - `CodebaseRunEvent`
   - `RealtimeConnectionState`
   - `ApiError`
2. Keep model definitions centralized and reused across all features.

## 11. Security Requirements
Tasks:
1. Store auth tokens in `expo-secure-store`.
2. Avoid logging secrets/tokens/auth headers.
3. Enforce HTTPS usage.
4. Keep ephemeral realtime secrets in-memory only.
5. Apply safe error handling for production logs.

## 12. Performance Requirements
Tasks:
1. Optimize first render and navigation transitions.
2. Keep realtime connection startup responsive.
3. Keep chat and run list updates smooth under normal network conditions.
4. Avoid heavy re-renders via memoized reusable components/hooks.

## 13. QA / Acceptance Criteria
Tasks:
1. Validate sign in persistence across app restarts.
2. Validate realtime voice start/stop/mute/unmute flows.
3. Validate voice + text in same conversation.
4. Validate run listing, run details, and cancel action.
5. Validate reconnect and fallback behavior on network drop.
6. Validate mic permission denied flow.
7. Validate production EAS build and TestFlight install.

## 14. App Store Readiness
Tasks:
1. Add microphone usage description in iOS config.
2. Ensure in-app account deletion initiation exists.
3. Complete accurate privacy metadata.
4. Add Terms and Privacy links.

## 15. Delivery Tasks
1. Scaffold app and routing.
2. Implement shared design system primitives.
3. Implement shared API/auth/realtime core modules.
4. Implement auth flow.
5. Implement chat (text + realtime voice).
6. Implement runs list/detail/cancel.
7. Implement account/signout/delete.
8. Execute QA checklist.
9. Produce EAS build and submission package.

## 16. Post-MVP Backlog
1. Push notifications for run completion.
2. Billing read-only view.
3. Passkey UX.
4. Advanced transcript/code rendering.
5. Android rollout.
