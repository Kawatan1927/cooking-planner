import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { listRecipesByUserMock } = vi.hoisted(() => ({
  listRecipesByUserMock: vi.fn(),
}));

vi.mock('./repository', () => ({
  listRecipesByUser: listRecipesByUserMock,
  findRecipeWithIngredients: vi.fn(),
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

describe('GET /api/recipes', () => {
  beforeEach(() => {
    listRecipesByUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('認証済みユーザーのレシピ一覧を返す', async () => {
    listRecipesByUserMock.mockResolvedValue([
      {
        recipeId: '11111111-1111-1111-1111-111111111111',
        userId: 'user-123',
        name: '親子丼',
        sourceBook: '和食本',
        sourcePage: 12,
        baseServings: 2,
        memo: '半熟にする',
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
      },
      {
        recipeId: '22222222-2222-2222-2222-222222222222',
        userId: 'user-123',
        name: 'みそ汁',
        sourceBook: null,
        sourcePage: null,
        baseServings: 1,
        memo: null,
        createdAt: '2026-05-22T00:00:00.000Z',
        updatedAt: '2026-05-22T00:00:00.000Z',
      },
    ]);

    const response = await app.request('/api/recipes');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        recipeId: '11111111-1111-1111-1111-111111111111',
        name: '親子丼',
        sourceBook: '和食本',
        sourcePage: 12,
        baseServings: 2,
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
      },
      {
        recipeId: '22222222-2222-2222-2222-222222222222',
        name: 'みそ汁',
        sourceBook: null,
        sourcePage: null,
        baseServings: 1,
        createdAt: '2026-05-22T00:00:00.000Z',
        updatedAt: '2026-05-22T00:00:00.000Z',
      },
    ]);
    expect(listRecipesByUserMock).toHaveBeenCalledWith('user-123');
  });

  it('レシピがない場合は空配列を返す', async () => {
    listRecipesByUserMock.mockResolvedValue([]);

    const response = await app.request('/api/recipes');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('repository例外時は500を返す', async () => {
    listRecipesByUserMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await app.request('/api/recipes');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch recipes',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
