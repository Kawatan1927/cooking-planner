import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { deleteMenu } from '../api/menus';
import { getUserCacheKey, menusQueryKeys } from './queryKeys';

export interface UseDeleteMenuOptions {
  userCacheKey?: string | null;
}

export function useDeleteMenu({ userCacheKey }: UseDeleteMenuOptions = {}) {
  const token = useAuthToken();
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useMutation<void, Error, string>({
    mutationFn: async menuId => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }

      return deleteMenu(menuId, token);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: menusQueryKeys.all(cacheUserKey),
      });
    },
  });
}
