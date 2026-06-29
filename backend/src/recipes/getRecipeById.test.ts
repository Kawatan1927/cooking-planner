import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Blob } from 'node:buffer';

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
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

let app: (typeof import('../app'))['default'];

type BunFile = Blob & { exists: () => Promise<boolean> };
type BunStaticRuntime = {
  file: (path: string) => BunFile;
  write: (path: string, data: string | Blob) => Promise<void>;
};

const installBunStaticShim = (): void => {
  const runtimeGlobal = globalThis as typeof globalThis & {
    Bun?: BunStaticRuntime;
  };

  runtimeGlobal.Bun ??= {
    file: path =>
      Object.assign(new Blob(existsSync(path) ? [readFileSync(path)] : []), {
        exists: async () => existsSync(path),
      }),
    write: async (path, data) => {
      await writeFile(path, data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data);
    },
  };
};

beforeAll(async () => {
  installBunStaticShim();
  ({ default: app } = await import('../app'));
});

describe('GET /api/recipes/:recipeId', () => {
  beforeEach(() => {
    findRecipeWithIngredientsMock.mockReset();
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
});
