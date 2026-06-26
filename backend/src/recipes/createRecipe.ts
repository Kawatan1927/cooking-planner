import type { Context } from 'hono';
import { createRecipeWithIngredients } from './repository';
import { RecipeBody, validateRecipeBody } from './validation';
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

    let requestBody: RecipeBody;
    try {
      requestBody = await c.req.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const validationError = validateRecipeBody(requestBody);
    if (validationError) {
      return validationError;
    }

    const recipeId = await createRecipeWithIngredients(
      {
        userId,
        name: requestBody.name,
        sourceBook: requestBody.sourceBook ?? null,
        sourcePage: requestBody.sourcePage ?? null,
        baseServings: requestBody.baseServings,
        memo: requestBody.memo ?? null,
      },
      requestBody.ingredients.map(ingredient => ({
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
