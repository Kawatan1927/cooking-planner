import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeIngredient } from '../shared/types';

interface RecipeIngredientResponse {
  ingredientName: string;
  quantity: number;
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

const createErrorResponse = (
  statusCode: number,
  code: string,
  message: string
): APIGatewayProxyResultV2 => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    error: {
      code,
      message,
      details: null,
    },
  }),
});

/**
 * GET /recipes/{recipeId}
 * Get a single recipe with its ingredients for the logged-in user
 */
export const getRecipeById = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const subClaim = event.requestContext.authorizer?.jwt?.claims?.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User ID not found in token');
    }

    const recipeId = event.pathParameters?.recipeId;
    if (!recipeId) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Recipe ID is required');
    }

    const userId = subClaim;

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
      return createErrorResponse(404, 'RECIPE_NOT_FOUND', 'Recipe not found');
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

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error fetching recipe by ID:', {
      errorName,
      error,
    });

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to fetch recipe');
  }
};
