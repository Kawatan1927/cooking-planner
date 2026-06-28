const MENUS_QUERY_SCOPE = 'menus';
const DEFAULT_USER_CACHE_KEY = 'cloudflare-access-user';

export const getUserCacheKey = (userCacheKey?: string | null): string =>
  userCacheKey || DEFAULT_USER_CACHE_KEY;

export const menusQueryKeys = {
  all: (userKey: string) => [MENUS_QUERY_SCOPE, userKey] as const,
  list: (userKey: string, from?: string, to?: string) =>
    [MENUS_QUERY_SCOPE, userKey, from || null, to || null] as const,
};
