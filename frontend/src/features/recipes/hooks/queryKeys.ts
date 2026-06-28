const RECIPES_QUERY_SCOPE = 'recipes';
const DEFAULT_USER_CACHE_KEY = 'cloudflare-access-user';

export const getUserCacheKey = (userCacheKey?: string | null): string =>
  userCacheKey || DEFAULT_USER_CACHE_KEY;

export const recipesQueryKeys = {
  list: (userKey: string) => [RECIPES_QUERY_SCOPE, userKey] as const,
  detail: (userKey: string, recipeId: string) => [RECIPES_QUERY_SCOPE, userKey, recipeId] as const,
};
