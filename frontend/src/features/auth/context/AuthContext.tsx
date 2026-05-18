import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { clearAuthToken, getAuthToken, saveAuthToken } from '../utils/cognito';
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
      },
    }),
    [token, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
