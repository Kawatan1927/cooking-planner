import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { updateMenuForUser } from './repository';

const { updateMenuForUserMock } = vi.hoisted(() => ({
  updateMenuForUserMock: vi.fn<typeof updateMenuForUser>(),
}));

vi.mock('./repository', () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: updateMenuForUserMock,
  deleteMenuForUser: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

const MENU_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const putMenu = (body: unknown) =>
  app.request(`/api/menus/${MENU_UUID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PUT /api/menus/:menuId', () => {
  beforeEach(() => {
    updateMenuForUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
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
    expect(await response.json()).toEqual({ menuId: MENU_UUID });
    expect(updateMenuForUserMock).toHaveBeenCalledWith('user-123', MENU_UUID, {
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

  it('UUID 形式でない menuId は 404 を返し、リポジトリを呼ばない', async () => {
    const response = await app.request('/api/menus/not-a-uuid', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-05-21',
        mealType: 'LUNCH',
        recipeId: 'recipe-new',
        servings: 2,
      }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'MENU_NOT_FOUND', message: 'Menu not found', details: null },
    });
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
  });

  it('JSONとして解析できないbodyは400を返しrepositoryを呼ばない', async () => {
    const response = await app.request(`/api/menus/${MENU_UUID}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid JSON in request body',
        details: null,
      },
    });
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
  });

  it.each([
    { caseName: 'null', body: null },
    { caseName: '配列', body: [] },
    { caseName: '文字列', body: 'menu' },
  ])('トップレベルbodyが$caseNameの場合は400を返す', async ({ body }) => {
    const response = await putMenu(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Request body must be an object',
        details: null,
      },
    });
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
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

  it('mealTypeが不正な場合は400を返しrepositoryを呼ばない', async () => {
    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'SNACK',
      recipeId: 'recipe-new',
      servings: 2,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER',
        details: null,
      },
    });
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
  });

  it('別ユーザーまたは対象なしは404を返す', async () => {
    updateMenuForUserMock.mockResolvedValue(false);

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 2,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'MENU_NOT_FOUND', message: 'Menu not found', details: null },
    });
    expect(updateMenuForUserMock).toHaveBeenCalledWith('user-123', MENU_UUID, expect.any(Object));
  });

  it('repository例外時は500を返す', async () => {
    updateMenuForUserMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 2,
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update menu',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
