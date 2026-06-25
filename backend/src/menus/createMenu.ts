import type { Context } from 'hono';
import { createMenu as insertMenu } from './repository';
import { MealType, MenuBody, validateMenuBody } from './validation';
import { HandlerResult, badRequest, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * POST /menus
 * 献立を1件登録する。
 */
export const createMenu = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);

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

    console.log(`Creating menu for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

    const menuId = await insertMenu({
      userId,
      date: requestBody.date,
      mealType: requestBody.mealType as MealType,
      recipeId: requestBody.recipeId,
      servings: requestBody.servings,
      memo: requestBody.memo ?? null,
    });

    return jsonResponse(201, { menuId });
  } catch (error) {
    console.error('Error creating menu:', error);
    return internalServerError('Failed to create menu');
  }
};
