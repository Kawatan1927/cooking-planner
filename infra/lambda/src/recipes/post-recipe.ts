import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { v4 as uuidv4 } from 'uuid';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { CreateRecipeRequest, CreateRecipeResponse, Recipe, RecipeIngredient } from '../shared/types';

/**
 * POST /recipes handler
 * Create a new recipe with ingredients
 */
export const handlePostRecipe = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // Extract userId from JWT claims
    // For API Gateway HTTP API with JWT authorizer, claims are in requestContext.authorizer.jwt.claims
    const claims = (event.requestContext as any).authorizer?.jwt?.claims;
    const userId = claims?.sub as string;
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User ID not found in token',
            details: null,
          },
        }),
      };
    }

    // Parse and validate request body
    if (!event.body) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'BAD_REQUEST',
            message: 'Request body is required',
            details: null,
          },
        }),
      };
    }

    let requestBody: CreateRecipeRequest;
    try {
      requestBody = JSON.parse(event.body);
    } catch (e) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'BAD_REQUEST',
            message: 'Invalid JSON in request body',
            details: null,
          },
        }),
      };
    }

    // Validate required fields
    if (!requestBody.name || typeof requestBody.name !== 'string') {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Recipe name is required and must be a string',
            details: null,
          },
        }),
      };
    }

    if (typeof requestBody.baseServings !== 'number' || requestBody.baseServings <= 0) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'baseServings is required and must be a positive number',
            details: null,
          },
        }),
      };
    }

    if (!Array.isArray(requestBody.ingredients)) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'ingredients must be an array',
            details: null,
          },
        }),
      };
    }

    // Validate ingredients
    for (const ingredient of requestBody.ingredients) {
      if (!ingredient.ingredientName || typeof ingredient.ingredientName !== 'string') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Each ingredient must have a valid ingredientName',
              details: null,
            },
          }),
        };
      }
      if (typeof ingredient.quantity !== 'number' || ingredient.quantity <= 0) {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Each ingredient must have a valid positive quantity',
              details: null,
            },
          }),
        };
      }
      if (!ingredient.unit || typeof ingredient.unit !== 'string') {
        return {
          statusCode: 400,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            error: {
              code: 'VALIDATION_ERROR',
              message: 'Each ingredient must have a valid unit',
              details: null,
            },
          }),
        };
      }
    }

    // Generate recipe ID
    const recipeId = uuidv4();
    const now = new Date().toISOString();

    // Create Recipe item
    const recipe: Recipe = {
      userId,
      recipeId,
      name: requestBody.name,
      sourceBook: requestBody.sourceBook || undefined,
      sourcePage: requestBody.sourcePage || undefined,
      baseServings: requestBody.baseServings,
      memo: requestBody.memo || undefined,
      createdAt: now,
      updatedAt: now,
    };

    // Save Recipe to DynamoDB
    await dynamoDbClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.RECIPES,
        Item: recipe,
      })
    );

    // Save RecipeIngredients to DynamoDB
    // According to the data model, SK should be "recipeId#ingredientName"
    for (const ingredient of requestBody.ingredients) {
      const recipeIngredient: RecipeIngredient & { SK: string } = {
        userId,
        SK: `${recipeId}#${ingredient.ingredientName}`,
        recipeId,
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note || undefined,
      };

      await dynamoDbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.RECIPE_INGREDIENTS,
          Item: recipeIngredient,
        })
      );
    }

    // Return response
    const response: CreateRecipeResponse = {
      recipeId,
    };

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error creating recipe:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred',
          details: null,
        },
      }),
    };
  }
};
