import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { 
  PutCommand, 
  DeleteCommand,
  BatchWriteCommand, 
  BatchWriteCommandInput,
  BatchWriteCommandOutput 
} from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeIngredient } from '../shared/types';
import { randomUUID } from 'crypto';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * Sanitize ingredient name for use in DynamoDB sort key
 * Replaces '#' with '_' to avoid conflicts with the delimiter
 */
const sanitizeIngredientNameForSK = (ingredientName: string): string => {
  return ingredientName.replace(/#/g, '_');
};

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

const BATCH_SIZE = 25;
const MAX_RETRIES = 3;

interface CreateRecipeRequestBody {
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  ingredients: Array<{
    ingredientName: string;
    quantity: number | string;
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
    const ingredientNames = new Set<string>();
    const sanitizedIngredientNames = new Map<string, string>(); // sanitized -> original
    
    for (const ingredient of requestBody.ingredients) {
      if (
        typeof ingredient !== 'object' ||
        ingredient === null ||
        Array.isArray(ingredient)
      ) {
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          'Each ingredient must be an object'
        );
      }

      if (!ingredient.ingredientName || typeof ingredient.ingredientName !== 'string') {
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          'Each ingredient must have a valid ingredientName'
        );
      }

      const trimmedIngredientName = ingredient.ingredientName.trim();
      const trimmedUnit = typeof ingredient.unit === 'string' ? ingredient.unit.trim() : '';

      if (!trimmedIngredientName) {
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          'Each ingredient must have a valid ingredientName'
        );
      }

      // Normalize ingredient name for duplicate checking (case-insensitive)
      const normalizedName = trimmedIngredientName.toLowerCase();

      // Check for duplicate ingredient names (case-insensitive)
      if (ingredientNames.has(normalizedName)) {
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          `Duplicate ingredient name: ${trimmedIngredientName}`
        );
      }
      ingredientNames.add(normalizedName);

      // Check for duplicates after sanitization
      const sanitizedName = sanitizeIngredientNameForSK(trimmedIngredientName).toLowerCase();
      if (sanitizedIngredientNames.has(sanitizedName)) {
        const conflictingName = sanitizedIngredientNames.get(sanitizedName);
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          `Ingredient names "${trimmedIngredientName}" and "${conflictingName}" would conflict after sanitization`
        );
      }
      sanitizedIngredientNames.set(sanitizedName, trimmedIngredientName);

      if (typeof ingredient.quantity === 'number') {
        if (ingredient.quantity <= 0) {
          return createErrorResponse(
            400,
            'BAD_REQUEST',
            'Each ingredient must have a positive quantity'
          );
        }

        if (!trimmedUnit) {
          return createErrorResponse(400, 'BAD_REQUEST', 'Each ingredient must have a unit');
        }
      } else if (typeof ingredient.quantity === 'string') {
        const trimmedQuantity = ingredient.quantity.trim();
        if (!trimmedQuantity) {
          return createErrorResponse(
            400,
            'BAD_REQUEST',
            'Each ingredient must have a non-empty quantity'
          );
        }

        const parsedQuantity = Number(trimmedQuantity);
        if (Number.isFinite(parsedQuantity) && parsedQuantity <= 0) {
          return createErrorResponse(
            400,
            'BAD_REQUEST',
            'Each ingredient must have a positive quantity'
          );
        }

        if (!trimmedUnit) {
          return createErrorResponse(400, 'BAD_REQUEST', 'Each ingredient must have a unit');
        }
      } else {
        return createErrorResponse(
          400,
          'BAD_REQUEST',
          'Each ingredient must have a quantity'
        );
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

    // Prepare ingredient items
    const ingredientItems = requestBody.ingredients.map((ingredient) => {
      const trimmedIngredientName = ingredient.ingredientName.trim();
      const trimmedUnit = ingredient.unit.trim();

      const recipeIngredient: RecipeIngredient = {
        userId,
        recipeId,
        ingredientName: trimmedIngredientName,
        quantity:
          typeof ingredient.quantity === 'string'
            ? ingredient.quantity.trim()
            : ingredient.quantity,
        unit: trimmedUnit,
        note: ingredient.note ?? undefined,
      };
      return recipeIngredient;
    });

    try {
      // Save recipe first. If ingredient writes fail later, compensate by deleting recipe+ingredients.
      await dynamoDbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.RECIPES,
          Item: recipe,
        })
      );

      console.log(`Recipe created: ${recipeId}`);

      // Save ingredients if any
      if (ingredientItems.length > 0) {
        // BatchWrite has a limit of 25 items per request
        // Split into chunks if needed
        for (let i = 0; i < ingredientItems.length; i += BATCH_SIZE) {
          const chunk = ingredientItems.slice(i, i + BATCH_SIZE);

          let requestItems: BatchWriteCommandInput['RequestItems'] = {
            [TABLE_NAMES.RECIPE_INGREDIENTS]: chunk.map((item) => ({
              PutRequest: {
                Item: {
                  ...item,
                  SK: `${recipeId}#${sanitizeIngredientNameForSK(item.ingredientName)}`,
                },
              },
            })),
          };

          // Retry logic for unprocessed items
          let retryCount = 0;

          while (retryCount < MAX_RETRIES) {
            const result: BatchWriteCommandOutput = await dynamoDbClient.send(
              new BatchWriteCommand({
                RequestItems: requestItems,
              })
            );

            // Check if there are unprocessed items
            if (!result.UnprocessedItems || Object.keys(result.UnprocessedItems).length === 0) {
              break; // All items processed successfully
            }

            // If there are unprocessed items, retry with exponential backoff
            requestItems = result.UnprocessedItems;
            retryCount++;

            if (retryCount < MAX_RETRIES) {
              const backoffTime = Math.pow(2, retryCount) * 100; // 200ms, 400ms, 800ms
              await new Promise((resolve) => setTimeout(resolve, backoffTime));
              console.log(`Retrying unprocessed items (attempt ${retryCount + 1}/${MAX_RETRIES})`);
            } else {
              // Max retries reached, log error and fail
              console.error(`Failed to write all ingredients after ${MAX_RETRIES} retries`);
              throw new Error('Failed to save all ingredients due to throttling');
            }
          }
        }

        console.log(`Saved ${ingredientItems.length} ingredients for recipe ${recipeId}`);
      }
    } catch (error) {
      console.error('Failed to persist recipe transactionally. Starting compensation.', {
        recipeId,
        error,
      });

      // Compensating delete for partial writes (ingredients)
      for (let i = 0; i < ingredientItems.length; i += BATCH_SIZE) {
        const chunk = ingredientItems.slice(i, i + BATCH_SIZE);

        let requestItems: BatchWriteCommandInput['RequestItems'] = {
          [TABLE_NAMES.RECIPE_INGREDIENTS]: chunk.map((item) => ({
            DeleteRequest: {
              Key: {
                userId: item.userId,
                SK: `${recipeId}#${sanitizeIngredientNameForSK(item.ingredientName)}`,
              },
            },
          })),
        };

        let retryCount = 0;
        while (retryCount < MAX_RETRIES) {
          const result: BatchWriteCommandOutput = await dynamoDbClient.send(
            new BatchWriteCommand({
              RequestItems: requestItems,
            })
          );

          if (!result.UnprocessedItems || Object.keys(result.UnprocessedItems).length === 0) {
            break;
          }

          requestItems = result.UnprocessedItems;
          retryCount++;

          if (retryCount < MAX_RETRIES) {
            const backoffTime = Math.pow(2, retryCount) * 100;
            await new Promise((resolve) => setTimeout(resolve, backoffTime));
          } else {
            console.error('Failed to delete all partially written ingredients during compensation', {
              recipeId,
            });
          }
        }
      }

      // Compensating delete for recipe item
      await dynamoDbClient.send(
        new DeleteCommand({
          TableName: TABLE_NAMES.RECIPES,
          Key: {
            userId,
            recipeId,
          },
        })
      );

      throw error;
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
