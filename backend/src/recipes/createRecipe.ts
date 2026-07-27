import type { Context } from 'hono';
import { createRecipeWithIngredients } from './repository';
import { validateRecipeBody } from './validation';
import { HandlerResult, badRequest, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * POST /recipes
 * 新しいレシピを材料とともに登録する。
 */
export const createRecipe = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    console.log(`Creating recipe for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

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

    const recipeId = await createRecipeWithIngredients(
      {
        userId,
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

    return jsonResponse(201, { recipeId });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return internalServerError('Failed to create recipe');
  }
};
