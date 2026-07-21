import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';
import { getShoppingList } from '../api/shoppingList';
import { useShoppingList } from './useShoppingList';

vi.mock('../api/shoppingList', () => ({ getShoppingList: vi.fn() }));

const response = {
  from: '2026-07-21',
  to: '2026-07-23',
  items: [],
};

describe('useShoppingList', () => {
  beforeEach(() => vi.resetAllMocks());

  it('期間が揃った有効なqueryで買い物リストを取得する', async () => {
    vi.mocked(getShoppingList).mockResolvedValue(response);
    const client = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useShoppingList({
          from: '2026-07-21',
          to: '2026-07-23',
          userCacheKey: 'user-a',
        }),
      { wrapper: createQueryWrapper(client) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getShoppingList).toHaveBeenCalledWith({
      from: '2026-07-21',
      to: '2026-07-23',
    });
  });

  it('fromまたはtoがない場合は取得しない', () => {
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useShoppingList({ to: '2026-07-23', userCacheKey: 'user-a' }), {
      wrapper,
    });
    renderHook(() => useShoppingList({ from: '2026-07-21', userCacheKey: 'user-a' }), {
      wrapper,
    });
    renderHook(() => useShoppingList({ userCacheKey: 'user-a' }), { wrapper });

    expect(getShoppingList).not.toHaveBeenCalled();
  });

  it('enabledがfalseの場合は期間が揃っていても取得しない', () => {
    const client = createTestQueryClient();

    renderHook(
      () =>
        useShoppingList({
          from: '2026-07-21',
          to: '2026-07-23',
          userCacheKey: 'user-a',
          enabled: false,
        }),
      { wrapper: createQueryWrapper(client) }
    );

    expect(getShoppingList).not.toHaveBeenCalled();
  });

  it('ユーザーまたは期間が異なるqueryでcacheを共有しない', async () => {
    vi.mocked(getShoppingList).mockResolvedValue(response);
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(
      () =>
        useShoppingList({
          from: '2026-07-21',
          to: '2026-07-23',
          userCacheKey: 'user-a',
        }),
      { wrapper }
    );
    renderHook(
      () =>
        useShoppingList({
          from: '2026-07-24',
          to: '2026-07-26',
          userCacheKey: 'user-a',
        }),
      { wrapper }
    );
    renderHook(
      () =>
        useShoppingList({
          from: '2026-07-21',
          to: '2026-07-23',
          userCacheKey: 'user-b',
        }),
      { wrapper }
    );

    await waitFor(() => expect(getShoppingList).toHaveBeenCalledTimes(3));
  });

  it('期間変更時に新しい期間で再取得する', async () => {
    vi.mocked(getShoppingList).mockResolvedValue(response);
    const client = createTestQueryClient();
    const { rerender } = renderHook(
      ({ from, to }) => useShoppingList({ from, to, userCacheKey: 'user-a' }),
      {
        initialProps: { from: '2026-07-21', to: '2026-07-23' },
        wrapper: createQueryWrapper(client),
      }
    );
    await waitFor(() => expect(getShoppingList).toHaveBeenCalledTimes(1));

    rerender({ from: '2026-07-24', to: '2026-07-26' });

    await waitFor(() => expect(getShoppingList).toHaveBeenCalledTimes(2));
    expect(getShoppingList).toHaveBeenLastCalledWith({
      from: '2026-07-24',
      to: '2026-07-26',
    });
  });
});
