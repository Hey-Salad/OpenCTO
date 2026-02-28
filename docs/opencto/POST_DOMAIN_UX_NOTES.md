# Post-Domain UX Hardening Notes

**Branch**: `feat/opencto-post-domain-ux-hardening`
**Date**: 2026-02-28
**Author**: Claude Code (claude-sonnet-4-6)

---

## Changes Made

### `public/app.html`

#### Auth UX improvements

- **Loading states**: Login and register submit buttons are disabled during API calls and display an animated spinner with contextual label ("Signing in..." / "Creating account..."). Buttons restore on error.
- **Clearer auth errors**: Added `mapAuthError()` which translates raw API error strings into human-readable messages covering: wrong credentials, duplicate account, account not found, weak password, invalid email format, and network failure.
- **Error auto-clear**: Switching between Login/Register tabs now clears any visible error message immediately.
- **Heading update on tab switch**: The `h2` heading now correctly updates to "Welcome back" or "Create your account" when switching tabs. Previously only the login tab updated the heading via a fragile `querySelector` selector; now both tabs use `id="auth-heading"` directly.
- **Fade transition**: `enterApp()` applies a 220 ms CSS fade-out on the auth page and a 250 ms fade-in on the app shell for a smooth handoff.

#### Demo Mode

- **Entry point**: A "Try Demo Mode" button is rendered below the Terms line on the auth form. No credentials required.
- **Activation**: `enterDemoMode()` sets `isDemoMode = true`, calls `enterApp()` (which skips all API calls in demo mode), then populates the app shell with static demo data from the `DEMO_DATA` constant.
- **Demo banner**: A full-width amber banner ("Demo Mode — local preview only. No data is sent to any server.") is shown at the top of the main content area when demo mode is active.
- **Exit paths**: The banner "Sign in with real account" button and the sidebar logout button both call `exitDemoMode()`, which resets state and returns to the auth screen.
- **No secrets**: `DEMO_DATA` contains only a placeholder email (`demo@opencto.works`) and static numeric values. No keys, tokens, or credentials are present.

#### Toast notifications

- Replaced `alert()` in `showToast()` with an inline DOM toast element. It appears in the bottom-right corner, auto-removes after 3.6 s, and supports `success`, `error`, and `info` variants via background color.

### `public/blog.html`

- Added `align-items:center` and `font-size:14px` to `.btn` to match landing page consistency.
- Tightened mobile nav `gap` to `12px` to reduce wrapping overlap on small viewports.

### `public/press.html`

- Added `align-items:center` and `font-size:14px` to `.btn`.
- Added `border-top` to `.bottom-cta` (was missing; blog and landing both have it).
- Standardized mobile breakpoint from `max-width:900px` to `max-width:980px`.
- Tightened mobile nav `gap` to `12px`.

---

## Known Limitations

1. **Demo Mode is static** — figures (42 requests, 18 340 tokens) are hardcoded. They will not reflect real usage and will not animate on page refresh.
2. **Demo Mode playground** — chat responses are simulated locally regardless of model selection. This is the existing behavior for all users; demo mode does not change it.
3. **Fade transition uses CSS animation classes** — if a user has `prefers-reduced-motion` enabled, the animation will still play. A follow-up should add a media query guard.
4. **Spinner uses innerHTML** — the loading state injection uses `innerHTML` to render the spinner element inside the button. This is safe here since no user data is interpolated, but is worth noting if the button template changes.
5. **Token revoke in demo mode** — `revokeToken()` is accessible but the token list is empty in demo mode, so it cannot be triggered. No guard is needed, but confirm this remains true if demo token stubs are added later.

---

## Next Steps for Backend-Auth Integration

1. **Replace static demo data** with a `/auth/demo` endpoint that returns a short-lived read-only token scoped to public demo usage.
2. **Add `prefers-reduced-motion` guard** to the auth fade animation CSS.
3. **Persist demo mode selection** to `sessionStorage` (not `localStorage`) so refreshing the page returns to the auth screen rather than entering live mode unexpectedly.
4. **Map additional API error codes** as the backend auth worker returns more specific HTTP status codes (e.g., 429 rate-limit, 503 maintenance).
5. **Upgrade `showToast`** to support a "Copy" action for new API key creation confirmation, replacing the current plain-text toast.
6. **Mobile nav audit** — once a mobile device test environment is available, verify the nav bar does not overlap page content at 320 px viewport width on all four routes (/, /blog, /press, /app).
