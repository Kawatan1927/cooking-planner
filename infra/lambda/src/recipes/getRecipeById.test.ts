import type { APIGatewayProxyEventV2WithJWTAuthorizer } from 'aws-lambda';
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

import { getRecipeById } from './getRecipeById';

const createEvent = (
  overrides: Partial<APIGatewayProxyEventV2WithJWTAuthorizer> = {}
): APIGatewayProxyEventV2WithJWTAuthorizer =>
  ({
    requestContext: {
      authorizer: {
        jwt: {
          claims: {
            sub: 'user-123',
          },
        },
      },
    },
    pathParameters: {
      recipeId: 'recipe-123',
    },
    ...overrides,
  }) as APIGatewayProxyEventV2WithJWTAuthorizer;

const parseBody = (body: string | undefined): unknown => JSON.parse(body ?? 'null');

describe('getRecipeById', () => {
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

    const response = await getRecipeById(createEvent());

    expect(response.statusCode).toBe(200);
    expect(parseBody(response.body)).toEqual({
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

    const response = await getRecipeById(createEvent());

    expect(response.statusCode).toBe(404);
    expect(parseBody(response.body)).toEqual({
      error: {
        code: 'RECIPE_NOT_FOUND',
        message: 'Recipe not found',
        details: null,
      },
    });
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it('recipeId がない場合は 400 を返す', async () => {
    const response = await getRecipeById(createEvent({ pathParameters: {} }));

    expect(response.statusCode).toBe(400);
    expect(parseBody(response.body)).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Recipe ID is required',
        details: null,
      },
    });
    expect(sendMock).not.toHaveBeenCalled();
  });
});
