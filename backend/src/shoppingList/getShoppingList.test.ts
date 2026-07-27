import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { listMenusInRange } from '../menus/repository';
import type { findRecipeWithIngredients } from '../recipes/repository';

const { listMenusInRangeMock, findRecipeWithIngredientsMock } = vi.hoisted(() => ({
  listMenusInRangeMock: vi.fn<typeof listMenusInRange>(),
  findRecipeWithIngredientsMock: vi.fn<typeof findRecipeWithIngredients>(),
}));

vi.mock('../menus/repository', () => ({
  listMenusInRange: listMenusInRangeMock,
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: vi.fn(),
}));

vi.mock('../recipes/repository', () => ({
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

const getShoppingListRequest = (from: string, to: string): Promise<Response> =>
  app.request(`/api/shopping-list?from=${from}&to=${to}`);

const menu = (menuId: string, date: string, recipeId: string, servings: number) => ({
  menuId,
  userId: 'user-123',
  date,
  mealType: 'DINNER' as const,
  recipeId,
  servings,
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
});

describe('GET /api/shopping-list', () => {
  beforeEach(() => {
    listMenusInRangeMock.mockReset();
    findRecipeWithIngredientsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('人数換算しながら材料を集計し、文字列数量は重複排除する', async () => {
    listMenusInRangeMock.mockResolvedValue([
      menu('menu-1', '2026-05-22', 'recipe-1', 1),
      menu('menu-2', '2026-05-23', 'recipe-1', 3),
      menu('menu-3', '2026-05-24', 'recipe-2', 1),
    ]);

    findRecipeWithIngredientsMock.mockImplementation(async (_userId: string, recipeId: string) => {
      if (recipeId === 'recipe-1') {
        return {
          recipe: {
            recipeId: 'recipe-1',
            userId: 'user-123',
            name: 'カレー',
            baseServings: 2,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          ingredients: [
            {
              recipeId: 'recipe-1',
              ingredientName: '玉ねぎ',
              quantity: 1,
              unit: '個',
            },
            {
              recipeId: 'recipe-1',
              ingredientName: '塩',
              quantity: '少々',
              unit: '適量',
            },
          ],
        };
      }
      if (recipeId === 'recipe-2') {
        return {
          recipe: {
            recipeId: 'recipe-2',
            userId: 'user-123',
            name: 'サラダ',
            baseServings: 1,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          ingredients: [
            {
              recipeId: 'recipe-2',
              ingredientName: '玉ねぎ',
              quantity: 0.5,
              unit: '個',
            },
            {
              recipeId: 'recipe-2',
              ingredientName: '塩',
              quantity: '少々',
              unit: '適量',
            },
            {
              recipeId: 'recipe-2',
              ingredientName: 'こしょう',
              quantity: '適量',
              unit: '適量',
            },
          ],
        };
      }
      return null;
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
        { ingredientName: '玉ねぎ', totalQuantity: 2.5, unit: '個' },
        { ingredientName: '塩', totalQuantity: '少々', unit: '適量' },
        { ingredientName: 'こしょう', totalQuantity: '適量', unit: '適量' },
      ])
    );
    expect(body.items).toHaveLength(3);
    expect(listMenusInRangeMock).toHaveBeenCalledWith('user-123', '2026-05-22', '2026-05-24');
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-1');
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-2');
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledTimes(2);
  });

  it('献立が0件の場合は空の買い物リストを返す', async () => {
    listMenusInRangeMock.mockResolvedValue([]);

    const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      from: '2026-05-22',
      to: '2026-05-24',
      items: [],
    });
    expect(listMenusInRangeMock).toHaveBeenCalledWith('user-123', '2026-05-22', '2026-05-24');
    expect(findRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it('複数献立を小数倍率で集計し、単位と文字列quantityを区別する', async () => {
    listMenusInRangeMock.mockResolvedValue([
      menu('menu-1', '2026-05-22', 'recipe-1', 1),
      menu('menu-2', '2026-05-23', 'recipe-1', 2),
      menu('menu-3', '2026-05-24', 'recipe-2', 1),
    ]);

    findRecipeWithIngredientsMock.mockImplementation(async (_userId, recipeId) => {
      if (recipeId === 'recipe-1') {
        return {
          recipe: {
            recipeId: 'recipe-1',
            userId: 'user-123',
            name: 'Recipe 1',
            baseServings: 2,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          ingredients: [
            { recipeId: 'recipe-1', ingredientName: 'Flour', quantity: 2, unit: 'g' },
            { recipeId: 'recipe-1', ingredientName: 'Salt', quantity: 2, unit: 'g' },
          ],
        };
      }
      if (recipeId === 'recipe-2') {
        return {
          recipe: {
            recipeId: 'recipe-2',
            userId: 'user-123',
            name: 'Recipe 2',
            baseServings: 4,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          ingredients: [
            { recipeId: 'recipe-2', ingredientName: 'Flour', quantity: 4, unit: 'g' },
            { recipeId: 'recipe-2', ingredientName: 'Flour', quantity: 1, unit: 'kg' },
            {
              recipeId: 'recipe-2',
              ingredientName: 'Salt',
              quantity: '適量',
              unit: 'g',
            },
            {
              recipeId: 'recipe-2',
              ingredientName: 'Salt',
              quantity: '少々',
              unit: 'g',
            },
            {
              recipeId: 'recipe-2',
              ingredientName: 'Salt',
              quantity: '適量',
              unit: 'g',
            },
          ],
        };
      }
      return null;
    });

    const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      from: '2026-05-22',
      to: '2026-05-24',
      items: [
        { ingredientName: 'Flour', totalQuantity: 4, unit: 'g' },
        { ingredientName: 'Flour', totalQuantity: 0.25, unit: 'kg' },
        { ingredientName: 'Salt', totalQuantity: '3 + 少々 + 適量', unit: 'g' },
      ],
    });
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledTimes(2);
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-1');
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-2');
  });

  it.each([
    {
      caseName: 'fromが未指定',
      path: '/api/shopping-list?to=2026-05-24',
      message: '"from" query parameter is required',
    },
    {
      caseName: 'toが未指定',
      path: '/api/shopping-list?from=2026-05-22',
      message: '"to" query parameter is required',
    },
    {
      caseName: 'fromの形式が不正',
      path: '/api/shopping-list?from=2026-5-22&to=2026-05-24',
      message: 'Invalid "from" date format. Use YYYY-MM-DD',
    },
    {
      caseName: 'toの形式が不正',
      path: '/api/shopping-list?from=2026-05-22&to=2026/05/24',
      message: 'Invalid "to" date format. Use YYYY-MM-DD',
    },
    {
      caseName: 'fromが実在しない日付',
      path: '/api/shopping-list?from=2026-02-30&to=2026-03-01',
      message: 'Invalid "from" date format. Use YYYY-MM-DD',
    },
    {
      caseName: 'toが実在しない日付',
      path: '/api/shopping-list?from=2026-02-01&to=2026-02-30',
      message: 'Invalid "to" date format. Use YYYY-MM-DD',
    },
    {
      caseName: 'fromがtoより後',
      path: '/api/shopping-list?from=2026-05-25&to=2026-05-24',
      message: '"from" date must not be after "to" date',
    },
  ])('$caseNameの場合は400を返しrepositoryを呼ばない', async ({ path, message }) => {
    const response = await app.request(path);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message,
        details: null,
      },
    });
    expect(listMenusInRangeMock).not.toHaveBeenCalled();
    expect(findRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it('献立が参照するレシピが見つからない場合は 500 を返す', async () => {
    listMenusInRangeMock.mockResolvedValue([menu('menu-1', '2026-05-22', 'recipe-missing', 2)]);
    findRecipeWithIngredientsMock.mockResolvedValue(null);

    const response = await getShoppingListRequest('2026-05-22', '2026-05-22');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compute shopping list',
        details: null,
      },
    });
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-missing');
  });

  it('献立repository例外時は500を返す', async () => {
    listMenusInRangeMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compute shopping list',
        details: null,
      },
    });
    expect(findRecipeWithIngredientsMock).not.toHaveBeenCalled();
    expect(consoleError).toHaveBeenCalled();
  });

  it('レシピrepository例外時は500を返す', async () => {
    listMenusInRangeMock.mockResolvedValue([menu('menu-1', '2026-05-22', 'recipe-1', 2)]);
    findRecipeWithIngredientsMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await getShoppingListRequest('2026-05-22', '2026-05-22');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to compute shopping list',
        details: null,
      },
    });
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-1');
    expect(consoleError).toHaveBeenCalled();
  });
});
