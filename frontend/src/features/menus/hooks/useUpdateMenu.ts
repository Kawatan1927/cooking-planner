import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMenu } from '../api/menus';
import type { MenuInput, UpdateMenuResponse } from '../types';
import { getUserCacheKey, menusQueryKeys } from './queryKeys';

export interface UseUpdateMenuOptions {
  menuId: string;
  userCacheKey?: string | null;
}

export function useUpdateMenu({ menuId, userCacheKey }: UseUpdateMenuOptions) {
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(userCacheKey);

  return useMutation<UpdateMenuResponse, Error, MenuInput>({
    mutationFn: data => updateMenu(menuId, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: menusQueryKeys.all(cacheUserKey),
      });
    },
  });
}
