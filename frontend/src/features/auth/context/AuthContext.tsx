import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  buildLogoutUrl,
  clearAuthToken,
  getCognitoConfig,
  getAuthToken,
  saveAuthToken,
} from '../utils/cognito';
import { AuthContext, type AuthContextValue } from './authContext';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const refreshToken = () => {
      setToken(getAuthToken());
      setIsLoading(false);
    };

    refreshToken();
    window.addEventListener('storage', refreshToken);
    window.addEventListener('focus', refreshToken);

    return () => {
      window.removeEventListener('storage', refreshToken);
      window.removeEventListener('focus', refreshToken);
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      isAuthenticated: !!token,
      isLoading,
      login: (nextToken: string) => {
        saveAuthToken(nextToken);
        setToken(nextToken);
      },
      logout: () => {
        clearAuthToken();
        setToken(null);
        // ローカルトークンを削除した後、Cognito のブラウザセッション Cookie も
        // 破棄するためにログアウトエンドポイントへリダイレクトする。
        // これにより共有端末でも即座にサインアウトが完了する。
        try {
          const config = getCognitoConfig();
          window.location.href = buildLogoutUrl(config);
        } catch {
          // Cognito 設定が未設定の場合（ローカル開発等）はトップへ遷移するだけ
          window.location.href = '/';
        }
      },
    }),
    [token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
