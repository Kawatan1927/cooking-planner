import { useQuery } from '@tanstack/react-query';
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
  const cacheUserKey = getUserCacheKey(userCacheKey);

  return useQuery<ShoppingListResponse, Error>({
    queryKey: shoppingListQueryKeys.list(cacheUserKey, from ?? '', to ?? ''),
    queryFn: async () => {
      if (!from || !to) {
        throw new Error('from と to の指定が必要です');
      }
      return getShoppingList({ from, to });
    },
    enabled: enabled && !!from && !!to,
  });
}
