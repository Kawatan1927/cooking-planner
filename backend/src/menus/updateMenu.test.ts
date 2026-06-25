import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMenuForUserMock } = vi.hoisted(() => ({
  updateMenuForUserMock: vi.fn(),
}));

vi.mock('./repository', () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: updateMenuForUserMock,
  deleteMenuForUser: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  getUserId: () => 'user-123',
}));

import app from '../app';

const putMenu = (body: unknown): Promise<Response> =>
  app.request('/menus/menu-123', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PUT /menus/:menuId', () => {
  beforeEach(() => {
    updateMenuForUserMock.mockReset();
  });

  it('更新に成功すると 200 と menuId を返す', async () => {
    updateMenuForUserMock.mockResolvedValue(true);

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 3,
      memo: '作り置き',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ menuId: 'menu-123' });
    expect(updateMenuForUserMock).toHaveBeenCalledWith('user-123', 'menu-123', {
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 3,
      memo: '作り置き',
    });
  });

  it('対象が見つからない場合は 404 を返す', async () => {
    updateMenuForUserMock.mockResolvedValue(false);

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 2,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'MENU_NOT_FOUND',
        message: 'Menu not found',
        details: null,
      },
    });
  });

  it('servings が不正な場合は 400 を返し、リポジトリを呼ばない', async () => {
    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'DINNER',
      recipeId: 'recipe-new',
      servings: 0,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: '"servings" must be a positive number',
        details: null,
      },
    });
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
  });
});
