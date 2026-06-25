import type { Context } from 'hono';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { findMenuByMenuId } from './utils';
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
 * Delete a menu item for the logged-in user
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

    const existingMenu = await findMenuByMenuId(userId, menuId);

    if (!existingMenu) {
      return notFound('Menu not found', 'MENU_NOT_FOUND');
    }

    await dynamoDbClient.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.MENUS,
        Key: { userId, SK: existingMenu.SK },
      })
    );

    console.log(`Menu deleted: ${menuId}`);

    return noContent();
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error deleting menu:', { errorName, error });

    if (errorName === 'ResourceNotFoundException') {
      return internalServerError('Menus table not found', 'RESOURCE_NOT_FOUND');
    }

    if (errorName === 'AccessDeniedException') {
      return internalServerError('Access denied while deleting menu', 'ACCESS_DENIED');
    }

    return internalServerError('Failed to delete menu');
  }
};
