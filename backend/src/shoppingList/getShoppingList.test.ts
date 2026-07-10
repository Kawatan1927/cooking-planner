import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMenusInRangeMock, findRecipeWithIngredientsMock } = vi.hoisted(() => ({
  listMenusInRangeMock: vi.fn(),
  findRecipeWithIngredientsMock: vi.fn(),
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
    expect(listMenusInRangeMock).not.toHaveBeenCalled();
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
  });
});
