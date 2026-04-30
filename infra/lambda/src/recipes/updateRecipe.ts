import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import {
  BatchWriteCommand,
  BatchWriteCommandInput,
  BatchWriteCommandOutput,
  GetCommand,
  PutCommand,
  QueryCommand,
  QueryCommandInput,
} from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeIngredient } from '../shared/types';

const BATCH_SIZE = 25;
const MAX_RETRIES = 3;

interface UpdateRecipeRequestBody {
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

interface RecipeIngredientItem extends RecipeIngredient {
  SK: string;
}

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

const sleep = (milliseconds: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, milliseconds));

const executeBatchWriteWithRetry = async (
  requestItems: BatchWriteCommandInput['RequestItems'],
  failureMessage: string
): Promise<void> => {
  let pendingRequestItems = requestItems;
  let retryCount = 0;

  while (retryCount < MAX_RETRIES) {
    const result: BatchWriteCommandOutput = await dynamoDbClient.send(
      new BatchWriteCommand({
        RequestItems: pendingRequestItems,
      })
    );

    if (!result.UnprocessedItems || Object.keys(result.UnprocessedItems).length === 0) {
      return;
    }

    pendingRequestItems = result.UnprocessedItems;
    retryCount++;

    if (retryCount < MAX_RETRIES) {
      const backoffTime = Math.pow(2, retryCount) * 100;
      await sleep(backoffTime);
    }
  }

  throw new Error(failureMessage);
};

const deleteRecipeIngredients = async (userId: string, ingredientKeys: string[]): Promise<void> => {
  for (let i = 0; i < ingredientKeys.length; i += BATCH_SIZE) {
    const chunk = ingredientKeys.slice(i, i + BATCH_SIZE);

    await executeBatchWriteWithRetry(
      {
        [TABLE_NAMES.RECIPE_INGREDIENTS]: chunk.map(ingredientKey => ({
          DeleteRequest: {
            Key: {
              userId,
              SK: ingredientKey,
            },
          },
        })),
      },
      'Failed to delete recipe ingredients due to throttling'
    );
  }
};

const putRecipeIngredients = async (ingredients: RecipeIngredient[]): Promise<void> => {
  for (let i = 0; i < ingredients.length; i += BATCH_SIZE) {
    const chunk = ingredients.slice(i, i + BATCH_SIZE);

    await executeBatchWriteWithRetry(
      {
        [TABLE_NAMES.RECIPE_INGREDIENTS]: chunk.map(ingredient => ({
          PutRequest: {
            Item: {
              ...ingredient,
              SK: `${ingredient.recipeId}#${sanitizeIngredientNameForSK(ingredient.ingredientName)}`,
            },
          },
        })),
      },
      'Failed to save recipe ingredients due to throttling'
    );
  }
};

const fetchAllRecipeIngredients = async (
  userId: string,
  recipeId: string
): Promise<RecipeIngredientItem[]> => {
  const ingredients: RecipeIngredientItem[] = [];
  let exclusiveStartKey: QueryCommandInput['ExclusiveStartKey'];

  do {
    const result = await dynamoDbClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.RECIPE_INGREDIENTS,
        KeyConditionExpression: 'userId = :userId AND begins_with(SK, :recipeIdPrefix)',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':recipeIdPrefix': `${recipeId}#`,
        },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    ingredients.push(...((result.Items || []) as RecipeIngredientItem[]));
    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return ingredients;
};

const validateRequestBody = (
  requestBody: UpdateRecipeRequestBody
): APIGatewayProxyResultV2 | null => {
  if (!requestBody.name || typeof requestBody.name !== 'string') {
    return createErrorResponse(400, 'BAD_REQUEST', 'Recipe name is required');
  }

  if (typeof requestBody.baseServings !== 'number' || requestBody.baseServings <= 0) {
    return createErrorResponse(400, 'BAD_REQUEST', 'baseServings must be a positive number');
  }

  if (!Array.isArray(requestBody.ingredients)) {
    return createErrorResponse(400, 'BAD_REQUEST', 'ingredients must be an array');
  }

  const ingredientNames = new Set<string>();
  const sanitizedIngredientNames = new Map<string, string>();

  for (const ingredient of requestBody.ingredients) {
    if (typeof ingredient !== 'object' || ingredient === null || Array.isArray(ingredient)) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Each ingredient must be an object');
    }

    if (!ingredient.ingredientName || typeof ingredient.ingredientName !== 'string') {
      return createErrorResponse(
        400,
        'BAD_REQUEST',
        'Each ingredient must have a valid ingredientName'
      );
    }

    const normalizedName = ingredient.ingredientName.toLowerCase().trim();
    if (ingredientNames.has(normalizedName)) {
      return createErrorResponse(
        400,
        'BAD_REQUEST',
        `Duplicate ingredient name: ${ingredient.ingredientName}`
      );
    }
    ingredientNames.add(normalizedName);

    const sanitizedName = sanitizeIngredientNameForSK(ingredient.ingredientName)
      .toLowerCase()
      .trim();
    if (sanitizedIngredientNames.has(sanitizedName)) {
      const conflictingName = sanitizedIngredientNames.get(sanitizedName);
      return createErrorResponse(
        400,
        'BAD_REQUEST',
        `Ingredient names "${ingredient.ingredientName}" and "${conflictingName}" would conflict after sanitization to "${sanitizedName}"`
      );
    }
    sanitizedIngredientNames.set(sanitizedName, ingredient.ingredientName);

    const hasValidNumericQuantity =
      typeof ingredient.quantity === 'number' && ingredient.quantity > 0;
    const hasValidTextQuantity =
      typeof ingredient.quantity === 'string' && ingredient.quantity.trim().length > 0;

    if (!hasValidNumericQuantity && !hasValidTextQuantity) {
      return createErrorResponse(
        400,
        'BAD_REQUEST',
        'Each ingredient must have a positive numeric quantity or a non-empty text quantity'
      );
    }

    if (!ingredient.unit || typeof ingredient.unit !== 'string') {
      return createErrorResponse(400, 'BAD_REQUEST', 'Each ingredient must have a unit');
    }
  }

  return null;
};

/**
 * PUT /recipes/{recipeId}
 * Update an existing recipe and replace its ingredients for the logged-in user
 */
export const updateRecipe = async (
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

    if (!event.body) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Request body is required');
    }

    let requestBody: UpdateRecipeRequestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'BAD_REQUEST', 'Invalid JSON in request body');
    }

    const validationError = validateRequestBody(requestBody);
    if (validationError) {
      return validationError;
    }

    const userId = subClaim;

    const existingRecipeResult = await dynamoDbClient.send(
      new GetCommand({
        TableName: TABLE_NAMES.RECIPES,
        Key: {
          userId,
          recipeId,
        },
      })
    );

    if (!existingRecipeResult.Item) {
      return createErrorResponse(404, 'RECIPE_NOT_FOUND', 'Recipe not found');
    }

    const existingRecipe = existingRecipeResult.Item as Recipe;

    const existingIngredients = await fetchAllRecipeIngredients(userId, recipeId);
    const existingIngredientsForRestore: RecipeIngredient[] = existingIngredients.map(
      ({
        userId: existingUserId,
        recipeId: existingRecipeId,
        ingredientName,
        quantity,
        unit,
        note,
      }) => ({
        userId: existingUserId,
        recipeId: existingRecipeId,
        ingredientName,
        quantity,
        unit,
        note,
      })
    );
    const now = new Date().toISOString();

    const updatedRecipe: Recipe = {
      userId,
      recipeId,
      name: requestBody.name,
      sourceBook: requestBody.sourceBook ?? undefined,
      sourcePage: requestBody.sourcePage ?? undefined,
      baseServings: requestBody.baseServings,
      memo: requestBody.memo ?? undefined,
      createdAt: existingRecipe.createdAt,
      updatedAt: now,
    };

    const updatedIngredients: RecipeIngredient[] = requestBody.ingredients.map(ingredient => ({
      userId,
      recipeId,
      ingredientName: ingredient.ingredientName,
      quantity: ingredient.quantity,
      unit: ingredient.unit,
      note: ingredient.note ?? undefined,
    }));
    const rollbackIngredientKeys = Array.from(
      new Set([
        ...existingIngredients.map(ingredient => ingredient.SK),
        ...updatedIngredients.map(
          ingredient =>
            `${ingredient.recipeId}#${sanitizeIngredientNameForSK(ingredient.ingredientName)}`
        ),
      ])
    );

    try {
      await dynamoDbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.RECIPES,
          Item: updatedRecipe,
          ConditionExpression: 'attribute_exists(recipeId)',
        })
      );

      await deleteRecipeIngredients(
        userId,
        existingIngredients.map(ingredient => ingredient.SK)
      );

      await putRecipeIngredients(updatedIngredients);
    } catch (error) {
      const errorName =
        typeof error === 'object' && error !== null && 'name' in error
          ? String(error.name)
          : 'UnknownError';

      if (errorName === 'ConditionalCheckFailedException') {
        throw error;
      }

      console.error('Failed to update recipe. Starting compensation.', {
        recipeId,
        error,
      });

      try {
        await dynamoDbClient.send(
          new PutCommand({
            TableName: TABLE_NAMES.RECIPES,
            Item: existingRecipe,
          })
        );

        await deleteRecipeIngredients(userId, rollbackIngredientKeys);

        await putRecipeIngredients(existingIngredientsForRestore);
      } catch (compensationError) {
        console.error('Failed to restore recipe after update failure', {
          recipeId,
          compensationError,
        });
      }

      throw error;
    }

    return {
      statusCode: 200,
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

    console.error('Error updating recipe:', {
      errorName,
      error,
    });

    if (errorName === 'ResourceNotFoundException') {
      return createErrorResponse(500, 'RESOURCE_NOT_FOUND', 'Required table not found');
    }

    if (errorName === 'AccessDeniedException') {
      return createErrorResponse(500, 'ACCESS_DENIED', 'Access denied while updating recipe');
    }

    if (errorName === 'ConditionalCheckFailedException') {
      return createErrorResponse(404, 'RECIPE_NOT_FOUND', 'Recipe not found');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to update recipe');
  }
};
