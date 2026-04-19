/**
 * 認証機能 - エクスポート用インデックス
 *
 * 認証機能の公開 API をまとめてエクスポートします。
 */

// Hooks
export { useAuthToken } from './hooks/useAuthToken';

// Pages
export { LoginPage } from './pages/LoginPage';
export { CallbackPage } from './pages/CallbackPage';

// Utils
export {
  AUTH_TOKEN_STORAGE_KEY,
  getCognitoConfig,
  buildLoginUrl,
  exchangeCodeForTokens,
  validateAndClearAuthState,
  getAndClearCodeVerifier,
  saveAuthToken,
  clearAuthToken,
} from './utils/cognito';
export type { CognitoConfig, TokenResponse } from './utils/cognito';
