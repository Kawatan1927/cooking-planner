import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { PutCommand, BatchWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeIngredient } from '../shared/types';
import { randomUUID } from 'crypto';

const USER_ID_LOG_PREFIX_LENGTH = 12;

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

interface CreateRecipeRequestBody {
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  ingredients: Array<{
    ingredientName: string;
    quantity: number;
    unit: string;
    note?: string | null;
  }>;
}

/**
 * POST /recipes
 * Create a new recipe with ingredients
 */
export const createRecipe = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    // Extract userId from JWT claims
    const subClaim = event.requestContext.authorizer.jwt.claims.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User ID not found in token');
    }

    const userId = subClaim;

    console.log(
      `Creating recipe for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    // Parse request body
    if (!event.body) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Request body is required');
    }

    let requestBody: CreateRecipeRequestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch (error) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Invalid JSON in request body');
    }

    // Validate required fields
    if (!requestBody.name || typeof requestBody.name !== 'string') {
      return createErrorResponse(400, 'BAD_REQUEST', 'Recipe name is required');
    }

    if (
      !requestBody.baseServings ||
      typeof requestBody.baseServings !== 'number' ||
      requestBody.baseServings <= 0
    ) {
      return createErrorResponse(
        400,
        'BAD_REQUEST',
        'baseServings must be a positive number'
      );
    }

    if (!Array.isArray(requestBody.ingredients)) {
      return createErrorResponse(400, 'BAD_REQUEST', 'ingredients must be an array');
    }

    // Validate each ingredient
    for (const ingredient of requestBody.ingredients) {
      if (!ingredient.ingredientName || typeof ingredient.ingredientName !== 'string') {
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          'Each ingredient must have a valid ingredientName'
        );
      }
      if (typeof ingredient.quantity !== 'number' || ingredient.quantity < 0) {
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          'Each ingredient must have a valid quantity'
        );
      }
      if (!ingredient.unit || typeof ingredient.unit !== 'string') {
        return createErrorResponse(400, 'BAD_REQUEST', 'Each ingredient must have a unit');
      }
    }

    // Generate recipeId and timestamps
    const recipeId = randomUUID();
    const now = new Date().toISOString();

    // Create recipe object
    const recipe: Recipe = {
      userId,
      recipeId,
      name: requestBody.name,
      sourceBook: requestBody.sourceBook ?? undefined,
      sourcePage: requestBody.sourcePage ?? undefined,
      baseServings: requestBody.baseServings,
      memo: requestBody.memo ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Save recipe to DynamoDB
    await dynamoDbClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.RECIPES,
        Item: recipe,
      })
    );

    console.log(`Recipe created: ${recipeId}`);

    // Save ingredients if any
    if (requestBody.ingredients.length > 0) {
      // Prepare ingredient items
      const ingredientItems = requestBody.ingredients.map((ingredient) => {
        const recipeIngredient: RecipeIngredient = {
          userId,
          recipeId,
          ingredientName: ingredient.ingredientName,
          quantity: ingredient.quantity,
          unit: ingredient.unit,
          note: ingredient.note ?? undefined,
        };
        return recipeIngredient;
      });

      // BatchWrite has a limit of 25 items per request
      // Split into chunks if needed
      const BATCH_SIZE = 25;
      for (let i = 0; i < ingredientItems.length; i += BATCH_SIZE) {
        const chunk = ingredientItems.slice(i, i + BATCH_SIZE);
        await dynamoDbClient.send(
          new BatchWriteCommand({
            RequestItems: {
              [TABLE_NAMES.RECIPE_INGREDIENTS]: chunk.map((item) => ({
                PutRequest: {
                  Item: {
                    ...item,
                    SK: `${recipeId}#${item.ingredientName}`,
                  },
                },
              })),
            },
          })
        );
      }

      console.log(`Saved ${ingredientItems.length} ingredients for recipe ${recipeId}`);
    }

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        recipeId,
      }),
    };
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error creating recipe:', {
      errorName,
      error,
    });

    if (errorName === 'ResourceNotFoundException') {
      return createErrorResponse(
        500,
        'RESOURCE_NOT_FOUND',
        'Required table not found'
      );
    }

    if (errorName === 'AccessDeniedException') {
      return createErrorResponse(
        500,
        'ACCESS_DENIED',
        'Access denied while creating recipe'
      );
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to create recipe');
  }
};
