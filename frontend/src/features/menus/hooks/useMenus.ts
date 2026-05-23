import { useQuery } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { getMenus } from '../api/menus';
import type { MenusResponse } from '../types';
import { getUserCacheKey, menusQueryKeys } from './queryKeys';

export interface UseMenusOptions {
  from?: string;
  to?: string;
  userCacheKey?: string | null;
  enabled?: boolean;
}

export function useMenus({ from, to, userCacheKey, enabled = true }: UseMenusOptions = {}) {
  const token = useAuthToken();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  const normalizedFrom = from || undefined;
  const normalizedTo = to || undefined;

  return useQuery<MenusResponse, Error>({
    queryKey: menusQueryKeys.list(cacheUserKey, normalizedFrom, normalizedTo),
    queryFn: async () => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }
      return getMenus({ from: normalizedFrom, to: normalizedTo }, token);
    },
    enabled: enabled && !!token,
  });
}
