import type { Context } from 'hono';
import { listRecipesByUser } from './repository';
import { RecipeResponse } from '../shared/types';
import { HandlerResult, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * GET /recipes
 * ログインユーザーの全レシピ一覧を返す。
 */
export const getRecipes = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    console.log(
      `Fetching recipes for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    const recipes = await listRecipesByUser(userId);

    const response: RecipeResponse[] = recipes.map(recipe => ({
      recipeId: recipe.recipeId,
      name: recipe.name,
      sourceBook: recipe.sourceBook ?? null,
      sourcePage: recipe.sourcePage ?? null,
      baseServings: recipe.baseServings,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    }));

    return jsonResponse(200, response);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return internalServerError('Failed to fetch recipes');
  }
};
