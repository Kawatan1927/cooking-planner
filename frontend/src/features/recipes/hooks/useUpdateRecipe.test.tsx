import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { updateRecipe } from '../api/recipes';
import type { UpdateRecipeRequest } from '../types';
import { recipesQueryKeys } from './queryKeys';
import { useUpdateRecipe } from './useUpdateRecipe';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/recipes', () => ({ updateRecipe: vi.fn() }));

const input = {
  name: 'スープ',
  baseServings: 2,
  ingredients: [],
} as UpdateRecipeRequest;

describe('useUpdateRecipe', () => {
  beforeEach(() => vi.resetAllMocks());

  it('成功後に一覧と対象詳細をinvalidateする', async () => {
    vi.mocked(updateRecipe).mockResolvedValue({ recipeId: 'recipe-1' });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(
      () => useUpdateRecipe({ recipeId: 'recipe-1', userCacheKey: 'user-a' }),
      { wrapper: createQueryWrapper(client) }
    );

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(updateRecipe).toHaveBeenCalledWith('recipe-1', input);
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: recipesQueryKeys.list('user-a'),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: recipesQueryKeys.detail('user-a', 'recipe-1'),
    });
  });

  it('失敗時はcacheをinvalidateしない', async () => {
    vi.mocked(updateRecipe).mockRejectedValue(new Error('更新失敗'));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useUpdateRecipe({ recipeId: 'recipe-1' }), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow('更新失敗');
    });

    expect(invalidate).not.toHaveBeenCalled();
  });
});
