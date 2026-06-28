import { useQuery } from '@tanstack/react-query';
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
  const cacheUserKey = getUserCacheKey(userCacheKey);

  const normalizedFrom = from || undefined;
  const normalizedTo = to || undefined;

  return useQuery<MenusResponse, Error>({
    queryKey: menusQueryKeys.list(cacheUserKey, normalizedFrom, normalizedTo),
    queryFn: () => getMenus({ from: normalizedFrom, to: normalizedTo }),
    enabled,
  });
}
