const SHOPPING_LIST_QUERY_SCOPE = 'shoppingList';
const DEFAULT_USER_CACHE_KEY = 'cloudflare-access-user';

export const getUserCacheKey = (userCacheKey?: string | null): string =>
  userCacheKey || DEFAULT_USER_CACHE_KEY;

export const shoppingListQueryKeys = {
  list: (userKey: string, from: string, to: string) =>
    [SHOPPING_LIST_QUERY_SCOPE, userKey, from, to] as const,
};
