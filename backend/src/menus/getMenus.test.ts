import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { listMenusInRange } from './repository';

const { listMenusInRangeMock } = vi.hoisted(() => ({
  listMenusInRangeMock: vi.fn<typeof listMenusInRange>(),
}));

vi.mock('./repository', () => ({
  listMenusInRange: listMenusInRangeMock,
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

describe('GET /api/menus', () => {
  beforeEach(() => {
    listMenusInRangeMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-21T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('期間未指定時は固定した今日から7日分を取得する', async () => {
    listMenusInRangeMock.mockResolvedValue([
      {
        menuId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
        userId: 'user-123',
        date: '2026-05-21',
        mealType: 'DINNER',
        recipeId: '11111111-2222-3333-4444-555555555555',
        servings: 2,
        memo: '作り置き',
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-20T00:00:00.000Z',
      },
    ]);

    const response = await app.request('/api/menus');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      from: '2026-05-21',
      to: '2026-05-27',
      items: [
        {
          menuId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
          date: '2026-05-21',
          mealType: 'DINNER',
          recipeId: '11111111-2222-3333-4444-555555555555',
          servings: 2,
        },
      ],
    });
    expect(listMenusInRangeMock).toHaveBeenCalledWith('user-123', '2026-05-21', '2026-05-27');
  });

  it('指定期間をrepositoryへ渡し、空結果を返す', async () => {
    listMenusInRangeMock.mockResolvedValue([]);

    const response = await app.request('/api/menus?from=2026-06-01&to=2026-06-03');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      from: '2026-06-01',
      to: '2026-06-03',
      items: [],
    });
    expect(listMenusInRangeMock).toHaveBeenCalledWith('user-123', '2026-06-01', '2026-06-03');
  });

  it.each([
    {
      caseName: 'fromの形式が不正',
      path: '/api/menus?from=2026-5-01&to=2026-05-03',
      message: 'Invalid "from" date format. Use YYYY-MM-DD',
    },
    {
      caseName: 'toが実在しない日付',
      path: '/api/menus?from=2026-02-01&to=2026-02-30',
      message: 'Invalid "to" date format. Use YYYY-MM-DD',
    },
    {
      caseName: 'fromがtoより後',
      path: '/api/menus?from=2026-06-04&to=2026-06-03',
      message: '"from" date must not be after "to" date',
    },
  ])('$caseNameの場合は400を返しrepositoryを呼ばない', async ({ path, message }) => {
    const response = await app.request(path);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'BAD_REQUEST', message, details: null },
    });
    expect(listMenusInRangeMock).not.toHaveBeenCalled();
  });

  it('repository例外時は500を返す', async () => {
    listMenusInRangeMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await app.request('/api/menus?from=2026-06-01&to=2026-06-03');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to fetch menus',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
