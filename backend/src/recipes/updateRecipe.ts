import type { Context } from 'hono';
import { replaceRecipeWithIngredients } from './repository';
import { validateRecipeBody } from './validation';
import {
  HandlerResult,
  badRequest,
  internalServerError,
  jsonResponse,
  notFound,
} from '../shared/http';
import { getUserId } from '../shared/auth';
import { isUuid } from '../shared/validation';

/**
 * PUT /recipes/{recipeId}
 * レシピ本体と材料リストを全置き換えで更新する。
 */
export const updateRecipe = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const recipeId = c.req.param('recipeId');
    if (!recipeId) {
      return badRequest('Recipe ID is required');
    }
    if (!isUuid(recipeId)) {
      return notFound('Recipe not found', 'RECIPE_NOT_FOUND');
    }

    let requestBody: unknown;
    try {
      requestBody = await c.req.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const validationResult = validateRecipeBody(requestBody);
    if (!validationResult.success) {
      return validationResult.error;
    }
    const recipeBody = validationResult.body;

    const updated = await replaceRecipeWithIngredients(
      userId,
      recipeId,
      {
        name: recipeBody.name,
        sourceBook: recipeBody.sourceBook ?? null,
        sourcePage: recipeBody.sourcePage ?? null,
        baseServings: recipeBody.baseServings,
        memo: recipeBody.memo ?? null,
      },
      recipeBody.ingredients.map(ingredient => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note ?? null,
      }))
    );

    if (!updated) {
      return notFound('Recipe not found', 'RECIPE_NOT_FOUND');
    }

    return jsonResponse(200, { recipeId });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return internalServerError('Failed to update recipe');
  }
};
