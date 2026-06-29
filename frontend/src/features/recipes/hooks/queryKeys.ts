import { getUserCacheKey } from '@/lib/queryKeyUtils';

const RECIPES_QUERY_SCOPE = 'recipes';

export { getUserCacheKey };

export const recipesQueryKeys = {
  list: (userKey: string) => [RECIPES_QUERY_SCOPE, userKey] as const,
  detail: (userKey: string, recipeId: string) => [RECIPES_QUERY_SCOPE, userKey, recipeId] as const,
};
