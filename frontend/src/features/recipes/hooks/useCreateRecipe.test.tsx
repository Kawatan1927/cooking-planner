import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRecipe } from '../api/recipes';
import type { CreateRecipeRequest } from '../types';
import { recipesQueryKeys } from './queryKeys';
import { useCreateRecipe } from './useCreateRecipe';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/recipes', () => ({ createRecipe: vi.fn() }));

const input = {
  name: 'スープ',
  baseServings: 2,
  ingredients: [],
} as CreateRecipeRequest;

describe('useCreateRecipe', () => {
  beforeEach(() => vi.resetAllMocks());

  it('登録成功後に対象ユーザーの一覧cacheをinvalidateする', async () => {
    vi.mocked(createRecipe).mockResolvedValue({ recipeId: 'recipe-1' });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => useCreateRecipe({ userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });

    await act(async () => {
      await result.current.mutateAsync(input);
    });

    expect(createRecipe).toHaveBeenCalledWith(input);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: recipesQueryKeys.list('user-a'),
      })
    );
  });
});
