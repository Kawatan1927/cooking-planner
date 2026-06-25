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

const getShoppingListRequest = (from: string, to: string): Promise<Response> =>
  app.request(`/shopping-list?from=${from}&to=${to}`);

describe('GET /shopping-list', () => {
  beforeEach(() => {
    sendMock.mockReset();
  });

  it('人数換算しながら材料を集計し、文字列数量は重複排除する', async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-123',
            menuId: 'menu-1',
            date: '2026-05-22',
            mealType: 'DINNER',
            recipeId: 'recipe-1',
            servings: 1,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          {
            userId: 'user-123',
            menuId: 'menu-2',
            date: '2026-05-23',
            mealType: 'DINNER',
            recipeId: 'recipe-1',
            servings: 3,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          {
            userId: 'user-123',
            menuId: 'menu-3',
            date: '2026-05-24',
            mealType: 'LUNCH',
            recipeId: 'recipe-2',
            servings: 1,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-123',
          recipeId: 'recipe-1',
          name: 'カレー',
          baseServings: 2,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-123',
            recipeId: 'recipe-1',
            ingredientName: '玉ねぎ',
            quantity: 1,
            unit: '個',
          },
          {
            userId: 'user-123',
            recipeId: 'recipe-1',
            ingredientName: '塩',
            quantity: '少々',
            unit: '適量',
          },
        ],
      })
      .mockResolvedValueOnce({
        Item: {
          userId: 'user-123',
          recipeId: 'recipe-2',
          name: 'サラダ',
          baseServings: 1,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        },
      })
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-123',
            recipeId: 'recipe-2',
            ingredientName: '玉ねぎ',
            quantity: 0.5,
            unit: '個',
          },
          {
            userId: 'user-123',
            recipeId: 'recipe-2',
            ingredientName: '塩',
            quantity: '少々',
            unit: '適量',
          },
          {
            userId: 'user-123',
            recipeId: 'recipe-2',
            ingredientName: 'こしょう',
            quantity: '適量',
            unit: '適量',
          },
        ],
      });

    const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      from: string;
      to: string;
      items: Array<{
        ingredientName: string;
        totalQuantity: number | string;
        unit: string;
      }>;
    };
    expect(body.from).toBe('2026-05-22');
    expect(body.to).toBe('2026-05-24');
    expect(body.items).toEqual(
      expect.arrayContaining([
        {
          ingredientName: '玉ねぎ',
          totalQuantity: 2.5,
          unit: '個',
        },
        {
          ingredientName: '塩',
          totalQuantity: '少々',
          unit: '適量',
        },
        {
          ingredientName: 'こしょう',
          totalQuantity: '適量',
          unit: '適量',
        },
      ])
    );
    expect(body.items).toHaveLength(3);
    expect(sendMock).toHaveBeenCalledTimes(5);
    expect(sendMock.mock.calls[0]?.[0].input).toMatchObject({
      TableName: 'Menus',
      ExpressionAttributeValues: {
        ':userId': 'user-123',
        ':fromSk': '2026-05-22#',
        ':toSk': '2026-05-24#￿',
      },
    });
  });

  it('from が to より後なら 400 を返す', async () => {
    const response = await getShoppingListRequest('2026-05-25', '2026-05-24');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: '"from" date must not be after "to" date',
        details: null,
      },
    });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('献立が参照するレシピが見つからない場合は 500 を返す', async () => {
    sendMock
      .mockResolvedValueOnce({
        Items: [
          {
            userId: 'user-123',
            menuId: 'menu-1',
            date: '2026-05-22',
            mealType: 'DINNER',
            recipeId: 'recipe-missing',
            servings: 2,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
        ],
      })
      .mockResolvedValueOnce({});

    const response = await getShoppingListRequest('2026-05-22', '2026-05-22');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compute shopping list',
        details: null,
      },
    });
    expect(sendMock).toHaveBeenCalledTimes(2);
  });
});
