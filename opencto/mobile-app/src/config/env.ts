export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://api.opencto.works';
export const TERMS_URL = process.env.EXPO_PUBLIC_TERMS_URL ?? 'https://opencto.works/terms';
export const PRIVACY_URL = process.env.EXPO_PUBLIC_PRIVACY_URL ?? 'https://opencto.works/privacy';
export const DEFAULT_REPO_URL = process.env.EXPO_PUBLIC_DEFAULT_REPO_URL ?? '';
export const DEFAULT_REPO_FULL_NAME = process.env.EXPO_PUBLIC_DEFAULT_REPO_FULL_NAME ?? '';
export const DEFAULT_BASE_BRANCH = process.env.EXPO_PUBLIC_DEFAULT_BASE_BRANCH ?? 'main';
export const DEFAULT_TARGET_BRANCH_PREFIX = process.env.EXPO_PUBLIC_DEFAULT_TARGET_BRANCH_PREFIX ?? 'opencto/mobile';
export const DEFAULT_RUN_COMMAND = process.env.EXPO_PUBLIC_DEFAULT_RUN_COMMAND ?? 'npm run build';
