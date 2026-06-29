import { getUserCacheKey } from '@/lib/queryKeyUtils';

const SHOPPING_LIST_QUERY_SCOPE = 'shoppingList';

export { getUserCacheKey };

export const shoppingListQueryKeys = {
  list: (userKey: string, from: string, to: string) =>
    [SHOPPING_LIST_QUERY_SCOPE, userKey, from, to] as const,
};
