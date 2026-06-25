import type { Context } from 'hono';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeIngredient } from '../shared/types';
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
 * Get a single recipe with its ingredients for the logged-in user
 */
export const getRecipeById = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);

    const recipeId = c.req.param('recipeId');
    if (!recipeId) {
      return badRequest('Recipe ID is required');
    }

    console.log(`Fetching recipe: userId=${userId}, recipeId=${recipeId}`);

    const recipeResult = await dynamoDbClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.RECIPES,
        Key: {
          userId,
          recipeId,
        },
      })
    );

    if (!recipeResult.Item) {
      return notFound('Recipe not found', 'RECIPE_NOT_FOUND');
    }

    const recipe = recipeResult.Item as Recipe;

    const ingredientsResult = await dynamoDbClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.RECIPE_INGREDIENTS,
        KeyConditionExpression: 'userId = :userId AND begins_with(SK, :recipeIdPrefix)',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':recipeIdPrefix': `${recipeId}#`,
        },
      })
    );

    const ingredientItems = (ingredientsResult.Items || []) as RecipeIngredient[];

    const response: RecipeDetailResponse = {
      recipeId: recipe.recipeId,
      name: recipe.name,
      sourceBook: recipe.sourceBook ?? null,
      sourcePage: recipe.sourcePage ?? null,
      baseServings: recipe.baseServings,
      memo: recipe.memo ?? null,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      ingredients: ingredientItems.map(ingredient => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note ?? null,
      })),
    };

    return jsonResponse(200, response);
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error fetching recipe by ID:', {
      errorName,
      error,
    });

    return internalServerError('Failed to fetch recipe');
  }
};
