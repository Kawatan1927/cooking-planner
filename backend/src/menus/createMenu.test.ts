import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { createMenu } from './repository';

const { createMenuMock } = vi.hoisted(() => ({
  createMenuMock: vi.fn<typeof createMenu>(),
}));

vi.mock('./repository', () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: createMenuMock,
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

const validBody = {
  date: '2026-05-21',
  mealType: 'DINNER',
  recipeId: '11111111-2222-3333-4444-555555555555',
  servings: 2,
};

const postMenu = (body: unknown) =>
  app.request('/api/menus', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/menus', () => {
  beforeEach(() => {
    createMenuMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('変換済み入力をrepositoryへ渡して201を返す', async () => {
    createMenuMock.mockResolvedValue('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');

    const response = await postMenu(validBody);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      menuId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
    });
    expect(createMenuMock).toHaveBeenCalledWith({
      userId: 'user-123',
      date: '2026-05-21',
      mealType: 'DINNER',
      recipeId: '11111111-2222-3333-4444-555555555555',
      servings: 2,
      memo: null,
    });
  });

  it('JSONとして解析できないbodyは400を返す', async () => {
    const response = await app.request('/api/menus', {
      method: 'POST',
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
    expect(createMenuMock).not.toHaveBeenCalled();
  });

  it.each([
    { caseName: 'null', body: null },
    { caseName: '配列', body: [] },
    { caseName: '文字列', body: 'menu' },
    { caseName: '数値', body: 1 },
    { caseName: '真偽値', body: true },
  ])('トップレベルbodyが$caseNameの場合は400を返す', async ({ body }) => {
    const response = await postMenu(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Request body must be an object',
        details: null,
      },
    });
    expect(createMenuMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'dateが空',
      body: { ...validBody, date: ' ' },
      message: 'Invalid "date" format. Use YYYY-MM-DD',
    },
    {
      caseName: 'dateが実在しない',
      body: { ...validBody, date: '2026-02-30' },
      message: 'Invalid "date" format. Use YYYY-MM-DD',
    },
    {
      caseName: 'mealTypeが許可値でない',
      body: { ...validBody, mealType: 'SNACK' },
      message: 'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER',
    },
    {
      caseName: 'mealTypeが文字列でない',
      body: { ...validBody, mealType: 1 },
      message: 'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER',
    },
    {
      caseName: 'recipeIdが空',
      body: { ...validBody, recipeId: ' ' },
      message: '"recipeId" is required',
    },
    {
      caseName: 'recipeIdが文字列でない',
      body: { ...validBody, recipeId: 1 },
      message: '"recipeId" is required',
    },
    {
      caseName: 'servingsが0',
      body: { ...validBody, servings: 0 },
      message: '"servings" must be a positive number',
    },
    {
      caseName: 'servingsが数値でない',
      body: { ...validBody, servings: '2' },
      message: '"servings" must be a positive number',
    },
  ])('$caseNameの場合は400を返しrepositoryを呼ばない', async ({ body, message }) => {
    const response = await postMenu(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'BAD_REQUEST', message, details: null },
    });
    expect(createMenuMock).not.toHaveBeenCalled();
  });

  it('repository例外時は500を返す', async () => {
    createMenuMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await postMenu(validBody);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create menu',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
