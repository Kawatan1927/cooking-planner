import type { Context } from 'hono';
import { deleteMenuForUser } from './repository';
import {
  HandlerResult,
  badRequest,
  internalServerError,
  noContent,
  notFound,
} from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * DELETE /menus/{menuId}
 * 献立を1件削除する。
 */
export const deleteMenu = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const menuId = c.req.param('menuId');
    if (!menuId) {
      return badRequest('Menu ID is required');
    }

    console.log(
      `Deleting menu ${menuId} for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    const deleted = await deleteMenuForUser(userId, menuId);
    if (!deleted) {
      return notFound('Menu not found', 'MENU_NOT_FOUND');
    }

    return noContent();
  } catch (error) {
    console.error('Error deleting menu:', error);
    return internalServerError('Failed to delete menu');
  }
};
