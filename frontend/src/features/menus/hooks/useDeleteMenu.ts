import { useMutation, useQueryClient } from '@tanstack/react-query';
import { deleteMenu } from '../api/menus';
import { getUserCacheKey, menusQueryKeys } from './queryKeys';

export interface UseDeleteMenuOptions {
  userCacheKey?: string | null;
}

export function useDeleteMenu({ userCacheKey }: UseDeleteMenuOptions = {}) {
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(userCacheKey);

  return useMutation<void, Error, string>({
    mutationFn: menuId => deleteMenu(menuId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: menusQueryKeys.all(cacheUserKey),
      });
    },
  });
}
