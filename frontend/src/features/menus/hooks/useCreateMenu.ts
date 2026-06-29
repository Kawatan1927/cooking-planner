import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createMenu } from '../api/menus';
import type { CreateMenuResponse, MenuInput } from '../types';
import { getUserCacheKey, menusQueryKeys } from './queryKeys';

export interface UseCreateMenuOptions {
  userCacheKey?: string | null;
}

export function useCreateMenu({ userCacheKey }: UseCreateMenuOptions = {}) {
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(userCacheKey);

  return useMutation<CreateMenuResponse, Error, MenuInput>({
    mutationFn: data => createMenu(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: menusQueryKeys.all(cacheUserKey),
      });
    },
  });
}
