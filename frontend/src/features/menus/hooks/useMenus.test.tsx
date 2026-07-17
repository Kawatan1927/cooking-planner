import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMenus } from '../api/menus';
import { useMenus } from './useMenus';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/menus', () => ({ getMenus: vi.fn() }));

describe('useMenus', () => {
  beforeEach(() => vi.resetAllMocks());

  it('有効時に正規化した期間で一覧を取得する', async () => {
    vi.mocked(getMenus).mockResolvedValue({ from: '', to: '', items: [] });
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useMenus({ from: '', to: '2026-07-07', userCacheKey: 'user-a' }),
      { wrapper: createQueryWrapper(client) }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getMenus).toHaveBeenCalledWith({ from: undefined, to: '2026-07-07' });
  });

  it('無効時は一覧を取得しない', () => {
    const client = createTestQueryClient();

    renderHook(() => useMenus({ enabled: false }), {
      wrapper: createQueryWrapper(client),
    });

    expect(getMenus).not.toHaveBeenCalled();
  });

  it('ユーザーまたは期間が異なるqueryでcacheを共有しない', async () => {
    vi.mocked(getMenus).mockResolvedValue({ from: '', to: '', items: [] });
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(() => useMenus({ from: '2026-07-01', to: '2026-07-07', userCacheKey: 'user-a' }), {
      wrapper,
    });
    renderHook(() => useMenus({ from: '2026-07-08', to: '2026-07-14', userCacheKey: 'user-a' }), {
      wrapper,
    });
    renderHook(() => useMenus({ from: '2026-07-01', to: '2026-07-07', userCacheKey: 'user-b' }), {
      wrapper,
    });

    await waitFor(() => expect(getMenus).toHaveBeenCalledTimes(3));
  });
});
