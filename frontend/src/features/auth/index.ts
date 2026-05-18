/**
 * 認証機能 - エクスポート用インデックス
 *
 * 認証機能の公開 API をまとめてエクスポートします。
 */

// Hooks
export { useAuthToken } from './hooks/useAuthToken';
export { useAuth } from './hooks/useAuth';
export { AuthProvider } from './context/AuthContext';

// Pages
export { LoginPage } from './pages/LoginPage';
export { CallbackPage } from './pages/CallbackPage';
export { ProtectedRoute } from './components/ProtectedRoute';

// Utils
export {
  AUTH_TOKEN_STORAGE_KEY,
  getCognitoConfig,
  buildLoginUrl,
  exchangeCodeForTokens,
  validateAndClearAuthState,
  getAndClearCodeVerifier,
  getAuthToken,
  saveAuthToken,
  clearAuthToken,
} from './utils/cognito';
export type { CognitoConfig, TokenResponse } from './utils/cognito';
