import type { Context } from 'hono';
import { updateMenuForUser } from './repository';
import { MealType, MenuBody, validateMenuBody } from './validation';
import {
  HandlerResult,
  badRequest,
  internalServerError,
  jsonResponse,
  notFound,
} from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * PUT /menus/{menuId}
 * 献立を1件更新する。date/mealType の変更も単一 UPDATE で扱う。
 */
export const updateMenu = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const menuId = c.req.param('menuId');
    if (!menuId) {
      return badRequest('Menu ID is required');
    }

    let requestBody: MenuBody;
    try {
      requestBody = await c.req.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const validationError = validateMenuBody(requestBody);
    if (validationError) {
      return validationError;
    }

    console.log(
      `Updating menu ${menuId} for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    const updated = await updateMenuForUser(userId, menuId, {
      date: requestBody.date,
      mealType: requestBody.mealType as MealType,
      recipeId: requestBody.recipeId,
      servings: requestBody.servings,
      memo: requestBody.memo ?? null,
    });

    if (!updated) {
      return notFound('Menu not found', 'MENU_NOT_FOUND');
    }

    return jsonResponse(200, { menuId });
  } catch (error) {
    console.error('Error updating menu:', error);
    return internalServerError('Failed to update menu');
  }
};
