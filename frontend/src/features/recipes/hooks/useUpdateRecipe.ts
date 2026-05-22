import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { updateRecipe } from '../api/recipes';
import type { UpdateRecipeRequest, UpdateRecipeResponse } from '../types';
import { getUserCacheKey, recipesQueryKeys } from './queryKeys';

export interface UseUpdateRecipeOptions {
  recipeId: string;
  userCacheKey?: string | null;
}

export function useUpdateRecipe({ recipeId, userCacheKey }: UseUpdateRecipeOptions) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useMutation<UpdateRecipeResponse, Error, UpdateRecipeRequest>({
    mutationFn: async data => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }

      return updateRecipe(recipeId, data, token);
    },
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
