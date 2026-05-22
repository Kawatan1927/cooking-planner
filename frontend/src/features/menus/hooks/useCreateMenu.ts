import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { createMenu } from '../api/menus';
import type { CreateMenuResponse, MenuInput } from '../types';
import { getUserCacheKey, menusQueryKeys } from './queryKeys';

export interface UseCreateMenuOptions {
  userCacheKey?: string | null;
}

export function useCreateMenu({ userCacheKey }: UseCreateMenuOptions = {}) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useMutation<CreateMenuResponse, Error, MenuInput>({
    mutationFn: async data => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }

      return createMenu(data, token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: menusQueryKeys.all(cacheUserKey),
      });
    },
  });
}
