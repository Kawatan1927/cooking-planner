import { getUserCacheKey } from '@/lib/queryKeyUtils';

const MENUS_QUERY_SCOPE = 'menus';

export { getUserCacheKey };

export const menusQueryKeys = {
  all: (userKey: string) => [MENUS_QUERY_SCOPE, userKey] as const,
  list: (userKey: string, from?: string, to?: string) =>
    [MENUS_QUERY_SCOPE, userKey, from || null, to || null] as const,
};
