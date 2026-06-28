import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateRecipe } from '../api/recipes';
import type { UpdateRecipeRequest, UpdateRecipeResponse } from '../types';
import { getUserCacheKey, recipesQueryKeys } from './queryKeys';

export interface UseUpdateRecipeOptions {
  recipeId: string;
  userCacheKey?: string | null;
}

export function useUpdateRecipe({ recipeId, userCacheKey }: UseUpdateRecipeOptions) {
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(userCacheKey);

  return useMutation<UpdateRecipeResponse, Error, UpdateRecipeRequest>({
    mutationFn: data => updateRecipe(recipeId, data),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({
          queryKey: recipesQueryKeys.list(cacheUserKey),
        }),
        queryClient.invalidateQueries({
          queryKey: recipesQueryKeys.detail(cacheUserKey, recipeId),
        }),
      ]);
    },
  });
}
