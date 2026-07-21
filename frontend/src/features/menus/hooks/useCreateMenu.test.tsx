import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMenu } from '../api/menus';
import type { MenuInput } from '../types';
import { menusQueryKeys } from './queryKeys';
import { useCreateMenu } from './useCreateMenu';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/menus', () => ({ createMenu: vi.fn() }));

const input: MenuInput = {
  date: '2026-07-01',
  mealType: 'DINNER',
  recipeId: 'recipe-1',
  servings: 2,
};

describe('useCreateMenu', () => {
  beforeEach(() => vi.resetAllMocks());

  it('登録成功後に対象ユーザーの献立cacheをinvalidateする', async () => {
    vi.mocked(createMenu).mockResolvedValue({ menuId: 'menu-1' });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateMenu({ userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(createMenu).toHaveBeenCalledWith(input);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: menusQueryKeys.all('user-a'),
      })
    );
  });

  it('登録失敗時はcacheをinvalidateしない', async () => {
    vi.mocked(createMenu).mockRejectedValue(new Error('登録失敗'));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateMenu({ userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow('登録失敗');
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
