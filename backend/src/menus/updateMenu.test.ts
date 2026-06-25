import { beforeEach, describe, expect, it, vi } from 'vitest';

const { sendMock, findMenuByMenuIdMock } = vi.hoisted(() => ({
  sendMock: vi.fn(),
  findMenuByMenuIdMock: vi.fn(),
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

vi.mock('./utils', () => ({
  findMenuByMenuId: findMenuByMenuIdMock,
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
    sendMock.mockReset();
    findMenuByMenuIdMock.mockReset();
  });

  it('日付または mealType が変わる場合はトランザクションで更新する', async () => {
    findMenuByMenuIdMock.mockResolvedValue({
      userId: 'user-123',
      SK: '2026-05-20#DINNER#menu-123',
      date: '2026-05-20',
      mealType: 'DINNER',
      menuId: 'menu-123',
      recipeId: 'recipe-old',
      servings: 2,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    sendMock.mockResolvedValueOnce({});

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 3,
      memo: '作り置き',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ menuId: 'menu-123' });
    expect(findMenuByMenuIdMock).toHaveBeenCalledWith('user-123', 'menu-123');
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0]?.[0].input).toMatchObject({
      TransactItems: [
        {
          Delete: {
            TableName: 'Menus',
            Key: { userId: 'user-123', SK: '2026-05-20#DINNER#menu-123' },
          },
        },
        {
          Put: {
            TableName: 'Menus',
            Item: expect.objectContaining({
              userId: 'user-123',
              SK: '2026-05-21#LUNCH#menu-123',
              date: '2026-05-21',
              mealType: 'LUNCH',
              recipeId: 'recipe-new',
              servings: 3,
              memo: '作り置き',
              createdAt: '2026-05-01T00:00:00.000Z',
            }),
          },
        },
      ],
    });
  });

  it('日付と mealType が変わらない場合は PutCommand で更新する', async () => {
    findMenuByMenuIdMock.mockResolvedValue({
      userId: 'user-123',
      SK: '2026-05-20#DINNER#menu-123',
      date: '2026-05-20',
      mealType: 'DINNER',
      menuId: 'menu-123',
      recipeId: 'recipe-old',
      servings: 2,
      createdAt: '2026-05-01T00:00:00.000Z',
      updatedAt: '2026-05-01T00:00:00.000Z',
    });
    sendMock.mockResolvedValueOnce({});

    const response = await putMenu({
      date: '2026-05-20',
      mealType: 'DINNER',
      recipeId: 'recipe-new',
      servings: 4,
      memo: null,
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ menuId: 'menu-123' });
    expect(sendMock).toHaveBeenCalledTimes(1);
    const input = sendMock.mock.calls[0]?.[0].input;
    expect(input).toMatchObject({
      TableName: 'Menus',
      Item: expect.objectContaining({
        userId: 'user-123',
        SK: '2026-05-20#DINNER#menu-123',
        date: '2026-05-20',
        mealType: 'DINNER',
        recipeId: 'recipe-new',
        servings: 4,
        createdAt: '2026-05-01T00:00:00.000Z',
      }),
      ConditionExpression: 'attribute_exists(userId) AND attribute_exists(SK)',
    });
    expect(input).not.toHaveProperty('TransactItems');
  });

  it('別 userId の献立は見つからず 404 を返す', async () => {
    findMenuByMenuIdMock.mockResolvedValue(null);

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
    expect(sendMock).not.toHaveBeenCalled();
  });

  it('servings が不正な場合は 400 を返す', async () => {
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
    expect(findMenuByMenuIdMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });
});
