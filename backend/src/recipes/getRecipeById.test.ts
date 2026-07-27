import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { findRecipeWithIngredients } from './repository';

const { findRecipeWithIngredientsMock } = vi.hoisted(() => ({
  findRecipeWithIngredientsMock: vi.fn<typeof findRecipeWithIngredients>(),
}));

vi.mock('./repository', () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: findRecipeWithIngredientsMock,
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

describe('GET /api/recipes/:recipeId', () => {
  beforeEach(() => {
    findRecipeWithIngredientsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('レシピ本体と材料一覧を返す', async () => {
    const recipeId = '11111111-1111-1111-1111-111111111111';
    findRecipeWithIngredientsMock.mockResolvedValue({
      recipe: {
        recipeId,
        userId: 'user-123',
        name: '親子丼',
        sourceBook: '和食本',
        sourcePage: 12,
        baseServings: 2,
        memo: 'メモ',
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
      },
      ingredients: [
        { recipeId, ingredientName: '鶏もも肉', quantity: 300, unit: 'g' },
        { recipeId, ingredientName: '卵', quantity: 2, unit: '個', note: '溶く' },
      ],
    });

    const response = await app.request(`/api/recipes/${recipeId}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recipeId,
      name: '親子丼',
      sourceBook: '和食本',
      sourcePage: 12,
      baseServings: 2,
      memo: 'メモ',
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
      ingredients: [
        { ingredientName: '鶏もも肉', quantity: 300, unit: 'g', note: null },
        { ingredientName: '卵', quantity: 2, unit: '個', note: '溶く' },
      ],
    });
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', recipeId);
  });

  it('別 userId のレシピは取得できず 404 を返す', async () => {
    const recipeId = '22222222-2222-2222-2222-222222222222';
    findRecipeWithIngredientsMock.mockResolvedValue(null);

    const response = await app.request(`/api/recipes/${recipeId}`);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'RECIPE_NOT_FOUND', message: 'Recipe not found', details: null },
    });
  });

  it('UUID 形式でない recipeId は 404 を返し、リポジトリを呼ばない', async () => {
    const response = await app.request('/api/recipes/not-a-uuid');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'RECIPE_NOT_FOUND', message: 'Recipe not found', details: null },
    });
    expect(findRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it('repository例外時は500を返す', async () => {
    const recipeId = '33333333-3333-3333-3333-333333333333';
    findRecipeWithIngredientsMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await app.request(`/api/recipes/${recipeId}`);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch recipe',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
