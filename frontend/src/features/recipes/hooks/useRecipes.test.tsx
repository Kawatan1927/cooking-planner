import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getRecipes } from '../api/recipes';
import { useRecipes } from './useRecipes';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/recipes', () => ({ getRecipes: vi.fn() }));

describe('useRecipes', () => {
  beforeEach(() => vi.clearAllMocks());

  it('有効時に一覧を取得する', async () => {
    vi.mocked(getRecipes).mockResolvedValue([]);
    const client = createTestQueryClient();
    const { result } = renderHook(() => useRecipes({ userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRecipes).toHaveBeenCalledOnce();
  });

  it('無効時は一覧を取得しない', () => {
    const client = createTestQueryClient();
    renderHook(() => useRecipes({ enabled: false }), {
      wrapper: createQueryWrapper(client),
    });
    expect(getRecipes).not.toHaveBeenCalled();
  });

  it('異なるユーザーのcacheを共有しない', async () => {
    vi.mocked(getRecipes).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const client = createTestQueryClient();
    renderHook(() => useRecipes({ userCacheKey: 'user-a' }), {
      wrapper: createQueryWrapper(client),
    });
    renderHook(() => useRecipes({ userCacheKey: 'user-b' }), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(getRecipes).toHaveBeenCalledTimes(2));
  });
});
