import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { deleteMenuForUser } from './repository';

const { deleteMenuForUserMock } = vi.hoisted(() => ({
  deleteMenuForUserMock: vi.fn<typeof deleteMenuForUser>(),
}));

vi.mock('./repository', () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: deleteMenuForUserMock,
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

const MENU_UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

describe('DELETE /api/menus/:menuId', () => {
  beforeEach(() => {
    deleteMenuForUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('認証済みユーザーの献立を削除して204を返す', async () => {
    deleteMenuForUserMock.mockResolvedValue(true);

    const response = await app.request(`/api/menus/${MENU_UUID}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(deleteMenuForUserMock).toHaveBeenCalledWith('user-123', MENU_UUID);
  });

  it('UUID形式でないmenuIdは404を返しrepositoryを呼ばない', async () => {
    const response = await app.request('/api/menus/not-a-uuid', {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'MENU_NOT_FOUND', message: 'Menu not found', details: null },
    });
    expect(deleteMenuForUserMock).not.toHaveBeenCalled();
  });

  it('別ユーザーまたは対象なしは404を返す', async () => {
    deleteMenuForUserMock.mockResolvedValue(false);

    const response = await app.request(`/api/menus/${MENU_UUID}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'MENU_NOT_FOUND', message: 'Menu not found', details: null },
    });
    expect(deleteMenuForUserMock).toHaveBeenCalledWith('user-123', MENU_UUID);
  });

  it('repository例外時は500を返す', async () => {
    deleteMenuForUserMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await app.request(`/api/menus/${MENU_UUID}`, {
      method: 'DELETE',
    });

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to delete menu',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
