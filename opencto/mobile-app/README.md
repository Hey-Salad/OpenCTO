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
EXPO_PUBLIC_DEFAULT_REPO_URL=https://github.com/your-org/your-repo
EXPO_PUBLIC_DEFAULT_REPO_FULL_NAME=your-org/your-repo
EXPO_PUBLIC_DEFAULT_BASE_BRANCH=main
EXPO_PUBLIC_DEFAULT_TARGET_BRANCH_PREFIX=opencto/mobile
EXPO_PUBLIC_DEFAULT_RUN_COMMAND=npm test
```
3. Start dev server:
```bash
npm run ios
```

## Validation
```bash
npm run lint
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
# Physical iPhone internal build (device install)
eas device:create
eas build --platform ios --profile development

# Simulator-only build (cannot be installed on iPhone)
eas build --platform ios --profile development-simulator

# TestFlight/App Store build
eas build --platform ios --profile production
eas submit --platform ios --profile production
```

If you see "This app cannot be installed because its integrity could not be verified":
- Verify you installed a device build profile (`development`, `preview`, or `production`) not a simulator profile.
- Re-register the device with `eas device:create` and rebuild.
- Delete old copies of the app before reinstalling.
- Use TestFlight for production distribution to avoid ad-hoc trust/provisioning issues.

## Security
- Auth tokens stored with `expo-secure-store`
- No token/header logging
- Realtime ephemeral token kept in memory only
