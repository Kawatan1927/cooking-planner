import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateMenu } from '../api/menus';
import type { MenuInput } from '../types';
import { menusQueryKeys } from './queryKeys';
import { useUpdateMenu } from './useUpdateMenu';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/menus', () => ({ updateMenu: vi.fn() }));

const input: MenuInput = {
  date: '2026-07-01',
  mealType: 'DINNER',
  recipeId: 'recipe-1',
  servings: 2,
};

describe('useUpdateMenu', () => {
  beforeEach(() => vi.resetAllMocks());

  it('更新成功後に対象ユーザーの献立cacheをinvalidateする', async () => {
    vi.mocked(updateMenu).mockResolvedValue({ menuId: 'menu-1' });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => useUpdateMenu({ menuId: 'menu-1', userCacheKey: 'user-a' }),
      { wrapper: createQueryWrapper(client) }
    );

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(updateMenu).toHaveBeenCalledWith('menu-1', input);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: menusQueryKeys.all('user-a'),
      })
    );
  });

  it('更新失敗時はcacheをinvalidateしない', async () => {
    vi.mocked(updateMenu).mockRejectedValue(new Error('更新失敗'));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => useUpdateMenu({ menuId: 'menu-1', userCacheKey: 'user-a' }),
      { wrapper: createQueryWrapper(client) }
    );

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow('更新失敗');
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
