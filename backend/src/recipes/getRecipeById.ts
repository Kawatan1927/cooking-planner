import type { Context } from 'hono';
import { findRecipeWithIngredients } from './repository';
import {
  HandlerResult,
  badRequest,
  internalServerError,
  jsonResponse,
  notFound,
} from '../shared/http';
import { getUserId } from '../shared/auth';

interface RecipeIngredientResponse {
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note: string | null;
}

interface RecipeDetailResponse {
  recipeId: string;
  name: string;
  sourceBook: string | null;
  sourcePage: number | null;
  baseServings: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredientResponse[];
}

/**
 * GET /recipes/{recipeId}
 * レシピ本体＋材料一覧を返す。
 */
export const getRecipeById = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const recipeId = c.req.param('recipeId');
    if (!recipeId) {
      return badRequest('Recipe ID is required');
    }

    const result = await findRecipeWithIngredients(userId, recipeId);
    if (!result) {
      return notFound('Recipe not found', 'RECIPE_NOT_FOUND');
    }

    const { recipe, ingredients } = result;
    const response: RecipeDetailResponse = {
      recipeId: recipe.recipeId,
      name: recipe.name,
      sourceBook: recipe.sourceBook ?? null,
      sourcePage: recipe.sourcePage ?? null,
      baseServings: recipe.baseServings,
      memo: recipe.memo ?? null,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      ingredients: ingredients.map(ingredient => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note ?? null,
      })),
    };

    return jsonResponse(200, response);
  } catch (error) {
    console.error('Error fetching recipe by ID:', error);
    return internalServerError('Failed to fetch recipe');
  }
};
