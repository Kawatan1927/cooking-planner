import { useQuery } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { getShoppingList } from '../api/shoppingList';
import type { ShoppingListResponse } from '../types';
import { getUserCacheKey, shoppingListQueryKeys } from './queryKeys';

export interface UseShoppingListOptions {
  from?: string;
  to?: string;
  userCacheKey?: string | null;
  enabled?: boolean;
}

export function useShoppingList({
  from,
  to,
  userCacheKey,
  enabled = true,
}: UseShoppingListOptions = {}) {
  const token = useAuthToken();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useQuery<ShoppingListResponse, Error>({
    queryKey: shoppingListQueryKeys.list(cacheUserKey, from ?? '', to ?? ''),
    queryFn: async () => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }
      if (!from || !to) {
        throw new Error('from と to の指定が必要です');
      }
      return getShoppingList({ from, to }, token);
    },
    enabled: enabled && !!token && !!from && !!to,
  });
}
