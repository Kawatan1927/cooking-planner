import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRecipe } from '../api/recipes';
import type { CreateRecipeRequest, CreateRecipeResponse } from '../types';
import { getUserCacheKey, recipesQueryKeys } from './queryKeys';

export interface UseCreateRecipeOptions {
  userCacheKey?: string | null;
}

export function useCreateRecipe({ userCacheKey }: UseCreateRecipeOptions = {}) {
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(userCacheKey);

  return useMutation<CreateRecipeResponse, Error, CreateRecipeRequest>({
    mutationFn: data => createRecipe(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: recipesQueryKeys.list(cacheUserKey),
      });
    },
  });
}
