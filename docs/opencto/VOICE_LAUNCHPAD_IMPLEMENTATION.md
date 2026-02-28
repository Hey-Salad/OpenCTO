# Voice Launchpad Implementation

## UI architecture
- The `/app` route now surfaces a dedicated marketing landing page that doubles as the Launchpad shell, keeping the React dashboard untouched.
- Layout: sticky header with navigation, left-hand Launchpad navigation, central voice console, and right-hand session config panel.
- Shared branding assets live in `public/assets/marketing.{css,js}` so landing/press/blog/app share nav, CTA, and responsive behavior.
- Theme strings are driven by CSS custom properties with a toggle that persists user preference in `localStorage` and updates `data-theme` on the `<body>`.

## State machine
- States: `idle` → `listening` → `paused` → `listening` → `stopped`.
- Buttons gate transitions: Start triggers `listening`, Pause only enabled while listening, Stop disabled when already stopped.
- Timer and transcript updates are bound to transitions; `start` resumes microphone access, `pause` freezes the timer, `stop` clears the stream and resets the clock.
- Toasts signal every state change while the translucent stream area shows timestamped entries and a lightweight waveform placeholder.
- Microphone permission failures surface a banner with actionable text and a toast alert, preventing the state machine from advancing until the user resolves browser permissions.

## Theme approach
- Default theme is dark with all surfaces and text tuned for high contrast (#111111 base, #f7f7f7 text, #ed4c4c highlights).
- Light mode swaps in lighter backgrounds and darker text while preserving the brand red/peach accents and border definitions.
- Toggle buttons add an `active` class to reflect selection and the `data-theme` attribute drives the CSS variable overrides for `--bg`, `--surface`, `--border`, etc.

## Known gaps
- Backend realtime integration: the Launchpad currently feeds mock timeline entries and transcript placeholders; hooking into a server-driven websocket or agent stream is required before production voice flows.
- STT/model binding: the UI assumes the `OpenCTO Voice Agent` model, but actual speech-to-text integration and token handling occur outside this static page and must be wired once backend services expose an API.
