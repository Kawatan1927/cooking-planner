import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { replaceRecipeWithIngredientsMock } = vi.hoisted(() => ({
  replaceRecipeWithIngredientsMock: vi.fn(),
}));

vi.mock('./repository', () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: vi.fn(),
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: replaceRecipeWithIngredientsMock,
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

const recipeId = '11111111-1111-1111-1111-111111111111';
const validBody = {
  name: '親子丼（更新）',
  sourceBook: '和食本',
  sourcePage: 12,
  baseServings: 3,
  memo: '薄味にする',
  ingredients: [
    {
      ingredientName: '鶏もも肉',
      quantity: 320,
      unit: 'g',
      note: '一口大',
    },
  ],
};

const putRecipe = (id: string, body: unknown) =>
  app.request(`/api/recipes/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PUT /api/recipes/:recipeId', () => {
  beforeEach(() => {
    replaceRecipeWithIngredientsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('変換済み入力をrepositoryへ渡して200を返す', async () => {
    replaceRecipeWithIngredientsMock.mockResolvedValue(true);

    const response = await putRecipe(recipeId, validBody);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recipeId });
    expect(replaceRecipeWithIngredientsMock).toHaveBeenCalledWith(
      'user-123',
      recipeId,
      {
        name: '親子丼（更新）',
        sourceBook: '和食本',
        sourcePage: 12,
        baseServings: 3,
        memo: '薄味にする',
      },
      [
        {
          ingredientName: '鶏もも肉',
          quantity: 320,
          unit: 'g',
          note: '一口大',
        },
      ]
    );
  });

  it('UUID形式でないrecipeIdは404を返しrepositoryを呼ばない', async () => {
    const response = await putRecipe('not-a-uuid', validBody);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'RECIPE_NOT_FOUND',
        message: 'Recipe not found',
        details: null,
      },
    });
    expect(replaceRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it('JSONとして解析できないbodyは400を返しrepositoryを呼ばない', async () => {
    const response = await app.request(`/api/recipes/${recipeId}`, {
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
    expect(replaceRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it('入力不正は400を返しrepositoryを呼ばない', async () => {
    const response = await putRecipe(recipeId, { ...validBody, name: ' ' });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Recipe name is required',
        details: null,
      },
    });
    expect(replaceRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it('別ユーザーまたは対象なしは404を返す', async () => {
    replaceRecipeWithIngredientsMock.mockResolvedValue(false);

    const response = await putRecipe(recipeId, validBody);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'RECIPE_NOT_FOUND',
        message: 'Recipe not found',
        details: null,
      },
    });
    expect(replaceRecipeWithIngredientsMock).toHaveBeenCalledWith(
      'user-123',
      recipeId,
      expect.any(Object),
      expect.any(Array)
    );
  });

  it('repository例外時は500を返す', async () => {
    replaceRecipeWithIngredientsMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await putRecipe(recipeId, validBody);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to update recipe',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
