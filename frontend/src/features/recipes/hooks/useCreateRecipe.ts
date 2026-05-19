import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { createRecipe } from '../api/recipes';
import type { CreateRecipeRequest, CreateRecipeResponse } from '../types';
import { getUserCacheKey, recipesQueryKeys } from './queryKeys';

export interface UseCreateRecipeOptions {
  userCacheKey?: string | null;
}

export function useCreateRecipe({ userCacheKey }: UseCreateRecipeOptions = {}) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useMutation<CreateRecipeResponse, Error, CreateRecipeRequest>({
    mutationFn: async data => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }

      return createRecipe(data, token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: recipesQueryKeys.list(cacheUserKey),
      });
    },
  });
}
