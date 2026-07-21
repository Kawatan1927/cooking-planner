import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { deleteMenu } from '../api/menus';
import { menusQueryKeys } from './queryKeys';
import { useDeleteMenu } from './useDeleteMenu';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/menus', () => ({ deleteMenu: vi.fn() }));

describe('useDeleteMenu', () => {
  beforeEach(() => vi.resetAllMocks());

  it('削除成功後に対象ユーザーの献立cacheをinvalidateする', async () => {
    vi.mocked(deleteMenu).mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteMenu({ userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync('menu-1');
    });

    expect(deleteMenu).toHaveBeenCalledWith('menu-1');
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: menusQueryKeys.all('user-a'),
      })
    );
  });

  it('削除失敗時はcacheをinvalidateしない', async () => {
    vi.mocked(deleteMenu).mockRejectedValue(new Error('削除失敗'));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useDeleteMenu({ userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync('menu-1')).rejects.toThrow('削除失敗');
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
