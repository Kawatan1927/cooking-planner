import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { Blob } from 'node:buffer';

const { updateMenuForUserMock } = vi.hoisted(() => ({
  updateMenuForUserMock: vi.fn(),
}));

vi.mock('./repository', () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: updateMenuForUserMock,
  deleteMenuForUser: vi.fn(),
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

const MENU_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

const putMenu = (body: unknown): Promise<Response> =>
  app.request(`/api/menus/${MENU_UUID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PUT /api/menus/:menuId', () => {
  beforeEach(() => {
    updateMenuForUserMock.mockReset();
  });

  it('更新に成功すると 200 と menuId を返す', async () => {
    updateMenuForUserMock.mockResolvedValue(true);

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 3,
      memo: '作り置き',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ menuId: MENU_UUID });
    expect(updateMenuForUserMock).toHaveBeenCalledWith('user-123', MENU_UUID, {
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 3,
      memo: '作り置き',
    });
  });

  it('対象が見つからない場合は 404 を返す', async () => {
    updateMenuForUserMock.mockResolvedValue(false);

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
  });

  it('UUID 形式でない menuId は 404 を返し、リポジトリを呼ばない', async () => {
    const response = await app.request('/api/menus/not-a-uuid', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date: '2026-05-21',
        mealType: 'LUNCH',
        recipeId: 'recipe-new',
        servings: 2,
      }),
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'MENU_NOT_FOUND', message: 'Menu not found', details: null },
    });
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
  });

  it('servings が不正な場合は 400 を返し、リポジトリを呼ばない', async () => {
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
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
  });
});
