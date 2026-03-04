# OpenCTO Mobile App (MVP v1)

iOS-first Expo mobile app for OpenCTO core workflows: auth, realtime voice + text chat, runs monitoring/cancel, and account actions.

## Requirements
- Node.js 20+
- npm 10+
- Expo CLI (`npx expo`)
- EAS CLI (`npm i -g eas-cli`)

## Setup
1. Install dependencies:
```bash
npm install
```
2. Optional env vars:
```bash
EXPO_PUBLIC_API_BASE_URL=https://api.opencto.works
EXPO_PUBLIC_TERMS_URL=https://opencto.works/terms
EXPO_PUBLIC_PRIVACY_URL=https://opencto.works/privacy
```
3. Start dev server:
```bash
npm run ios
```

## Validation
```bash
npm run lint
npm run typecheck
npm run build
npm run test
```

## Architecture
- `app/*`: Expo Router screens and layouts
- `src/components/*`: reusable UI and feature components
- `src/api/*`: shared API client, auth injection, error normalization, endpoint modules
- `src/state/*`: auth/chat/runs providers and centralized state
- `src/hooks/*`: reusable business hooks
- `src/realtime/*`: OpenAI-only realtime state machine and session manager
- `src/audio/*`: microphone permissions/session setup

## iOS Build and Submit
```bash
eas login
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

## Security
- Auth tokens stored with `expo-secure-store`
- No token/header logging
- Realtime ephemeral token kept in memory only
