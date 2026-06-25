import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findRecipeWithIngredientsMock } = vi.hoisted(() => ({
  findRecipeWithIngredientsMock: vi.fn(),
}));

vi.mock('./repository', () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: findRecipeWithIngredientsMock,
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  getUserId: () => 'user-123',
}));

import app from '../app';

describe('GET /recipes/:recipeId', () => {
  beforeEach(() => {
    findRecipeWithIngredientsMock.mockReset();
  });

  it('レシピ本体と材料一覧を返す', async () => {
    findRecipeWithIngredientsMock.mockResolvedValue({
      recipe: {
        recipeId: 'recipe-123',
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
        { recipeId: 'recipe-123', ingredientName: '鶏もも肉', quantity: 300, unit: 'g' },
        { recipeId: 'recipe-123', ingredientName: '卵', quantity: 2, unit: '個', note: '溶く' },
      ],
    });

    const response = await app.request('/recipes/recipe-123');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recipeId: 'recipe-123',
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
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-123');
  });

  it('別 userId のレシピは取得できず 404 を返す', async () => {
    findRecipeWithIngredientsMock.mockResolvedValue(null);

    const response = await app.request('/recipes/recipe-123');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'RECIPE_NOT_FOUND', message: 'Recipe not found', details: null },
    });
  });
});
