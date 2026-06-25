import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
}));

vi.mock('../shared/dynamodb', () => ({
  dynamoDbClient: { send: sendMock },
  TABLE_NAMES: {
    RECIPES: 'Recipes',
    RECIPE_INGREDIENTS: 'RecipeIngredients',
    MENUS: 'Menus',
    PANTRY_ITEMS: 'PantryItems',
  },
}));

vi.mock('../shared/auth', () => ({
  getUserId: () => 'user-123',
}));

import app from '../app';

describe('GET /recipes/:recipeId', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('レシピ本体と材料一覧を返す', async () => {
    sendMock
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-123',
          recipeId: 'recipe-123',
          name: '親子丼',
          sourceBook: '和食本',
          sourcePage: 12,
          baseServings: 2,
          memo: 'メモ',
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-21T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-123',
            recipeId: 'recipe-123',
            ingredientName: '鶏もも肉',
            quantity: 300,
            unit: 'g',
          },
          {
            userId: 'user-123',
            recipeId: 'recipe-123',
            ingredientName: '卵',
            quantity: 2,
            unit: '個',
            note: '溶く',
          },
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
        {
          ingredientName: '鶏もも肉',
          quantity: 300,
          unit: 'g',
          note: null,
        },
        {
          ingredientName: '卵',
          quantity: 2,
          unit: '個',
          note: '溶く',
        },
      ],
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
    expect(sendMock.mock.calls[0]?.[0].input).toMatchObject({
      TableName: 'Recipes',
      Key: {
        userId: 'user-123',
        recipeId: 'recipe-123',
      },
    });
    expect(sendMock.mock.calls[1]?.[0].input).toMatchObject({
      TableName: 'RecipeIngredients',
      ExpressionAttributeValues: {
        ':userId': 'user-123',
        ':recipeIdPrefix': 'recipe-123#',
      },
    });
  });

  it('別 userId のレシピは取得できず 404 を返す', async () => {
    sendMock.mockResolvedValueOnce({});

    const response = await app.request('/recipes/recipe-123');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: 'RECIPE_NOT_FOUND',
        message: 'Recipe not found',
        details: null,
      },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });
});
