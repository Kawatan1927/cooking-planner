import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { updateMenu } from '../api/menus';
import type { MenuInput, UpdateMenuResponse } from '../types';
import { getUserCacheKey, menusQueryKeys } from './queryKeys';

export interface UseUpdateMenuOptions {
  menuId: string;
  userCacheKey?: string | null;
}

export function useUpdateMenu({ menuId, userCacheKey }: UseUpdateMenuOptions) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useMutation<UpdateMenuResponse, Error, MenuInput>({
    mutationFn: async data => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }

      return updateMenu(menuId, data, token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: menusQueryKeys.all(cacheUserKey),
      });
    },
  });
}
