import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/apiClient';
import { createMenu, deleteMenu, getMenus, updateMenu } from './menus';
import type { MenuInput, MenusResponse } from '../types';

vi.mock('@/lib/apiClient', () => ({ apiFetch: vi.fn() }));

const response: MenusResponse = {
  from: '2026-07-01',
  to: '2026-07-07',
  items: [],
};

describe('menus API', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [{}, '/menus'],
    [{ from: '2026-07-01' }, '/menus?from=2026-07-01'],
    [{ to: '2026-07-07' }, '/menus?to=2026-07-07'],
    [{ from: '2026-07-01', to: '2026-07-07' }, '/menus?from=2026-07-01&to=2026-07-07'],
  ])('指定期間をquery parameterへ変換する', async (params, path) => {
    vi.mocked(apiFetch).mockResolvedValue(response);
    await expect(getMenus(params)).resolves.toBe(response);
    expect(apiFetch).toHaveBeenCalledWith(path, { method: 'GET' });
  });

  const input: MenuInput = {
    date: '2026-07-01',
    mealType: 'DINNER',
    recipeId: 'recipe-1',
    servings: 2,
  };

  it('POST /menusへ登録内容を渡す', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ menuId: 'menu-1' });
    await expect(createMenu(input)).resolves.toEqual({ menuId: 'menu-1' });
    expect(apiFetch).toHaveBeenCalledWith('/menus', { method: 'POST', body: input });
  });

  it('PUT /menus/{menuId}へ更新内容を渡す', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ menuId: 'menu-1' });
    await expect(updateMenu('menu-1', input)).resolves.toEqual({ menuId: 'menu-1' });
    expect(apiFetch).toHaveBeenCalledWith('/menus/menu-1', { method: 'PUT', body: input });
  });

  it('DELETE /menus/{menuId}を呼び出す', async () => {
    vi.mocked(apiFetch).mockResolvedValue(null);
    await expect(deleteMenu('menu-1')).resolves.toBeUndefined();
    expect(apiFetch).toHaveBeenCalledWith('/menus/menu-1', { method: 'DELETE' });
  });
});
