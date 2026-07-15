import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecipe } from '../api/recipes';
import { useRecipe } from './useRecipe';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/recipes', () => ({ getRecipe: vi.fn() }));

describe('useRecipe', () => {
  beforeEach(() => vi.resetAllMocks());

  it.each([
    { recipeId: '', enabled: true },
    { recipeId: 'recipe-1', enabled: false },
  ])('recipeId=$recipeId enabled=$enabledでは取得しない', ({ recipeId, enabled }) => {
    const client = createTestQueryClient();
    renderHook(() => useRecipe({ recipeId, enabled }), {
      wrapper: createQueryWrapper(client),
    });
    expect(getRecipe).not.toHaveBeenCalled();
  });

  it('ユーザーとrecipeIdごとにcacheを分離する', async () => {
    vi.mocked(getRecipe).mockResolvedValue({ recipeId: 'recipe-1' } as never);
    const client = createTestQueryClient();
    renderHook(() => useRecipe({ recipeId: 'recipe-1', userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });
    renderHook(() => useRecipe({ recipeId: 'recipe-2', userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });
    renderHook(() => useRecipe({ recipeId: 'recipe-1', userCacheKey: 'user-b' }), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(getRecipe).toHaveBeenCalledTimes(3));
  });
});
