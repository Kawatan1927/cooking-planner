import { useEffect, useState } from 'react';

const AUTH_TOKEN_STORAGE_KEY = 'cooking_planner_auth_token';

const readAuthToken = (): string | null => {
  const envToken = import.meta.env.VITE_AUTH_TOKEN ?? null;

  if (typeof window === 'undefined') {
    return envToken;
  }

  const storedToken = window.localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
  return storedToken || envToken;
};

export function useAuthToken(): string | null {
  const [token, setToken] = useState<string | null>(() => readAuthToken());

  useEffect(() => {
    const refreshToken = () => {
      setToken(readAuthToken());
    };

    window.addEventListener('storage', refreshToken);
    window.addEventListener('focus', refreshToken);

    return () => {
      window.removeEventListener('storage', refreshToken);
      window.removeEventListener('focus', refreshToken);
    };
  }, []);

  return token;
}
