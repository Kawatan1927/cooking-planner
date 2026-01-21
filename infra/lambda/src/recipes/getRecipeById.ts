import { APIGatewayProxyEventV2, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeIngredient } from '../shared/types';

/**
 * Response type for GET /recipes/{recipeId}
 */
interface RecipeDetailResponse extends Recipe {
  ingredients: RecipeIngredient[];
}

/**
 * Extended type for API Gateway event with JWT authorizer
 * This includes the authorizer context which is not in the base type
 */
interface APIGatewayProxyEventV2WithAuthorizer extends APIGatewayProxyEventV2 {
  requestContext: APIGatewayProxyEventV2['requestContext'] & {
    authorizer?: {
      jwt?: {
        claims?: {
          sub?: string;
          email?: string;
          [key: string]: unknown;
        };
      };
    };
  };
}

/**
 * Get a single recipe with its ingredients
 * 
 * @param event API Gateway event
 * @returns Recipe details with ingredients or error response
 */
export const getRecipeById = async (
  event: APIGatewayProxyEventV2
): Promise<APIGatewayProxyResultV2> => {
  try {
    // Extract userId from JWT claims
    const eventWithAuth = event as APIGatewayProxyEventV2WithAuthorizer;
    const userId = eventWithAuth.requestContext.authorizer?.jwt?.claims?.sub as string;
    if (!userId) {
      return {
        statusCode: 401,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'UNAUTHORIZED',
            message: 'User ID not found in JWT claims',
            details: null,
          },
        }),
      };
    }

    // Extract recipeId from path parameters
    const recipeId = event.pathParameters?.recipeId;
    if (!recipeId) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'BAD_REQUEST',
            message: 'Recipe ID is required',
            details: null,
          },
        }),
      };
    }

    console.log(`Fetching recipe: userId=${userId}, recipeId=${recipeId}`);

    // Get recipe from Recipes table
    const getRecipeCommand = new GetCommand({
      TableName: TABLE_NAMES.RECIPES,
      Key: {
        userId,
        recipeId,
      },
    });

    const recipeResult = await dynamoDbClient.send(getRecipeCommand);

    if (!recipeResult.Item) {
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          error: {
            code: 'RECIPE_NOT_FOUND',
            message: 'Recipe not found',
            details: null,
          },
        }),
      };
    }

    const recipe = recipeResult.Item as Recipe;

    // Query ingredients from RecipeIngredients table
    // Note: SK (Sort Key) structure is 'recipeId#ingredientName' as defined in docs/03-domain-and-data-model.md
    const queryIngredientsCommand = new QueryCommand({
      TableName: TABLE_NAMES.RECIPE_INGREDIENTS,
      KeyConditionExpression: 'userId = :userId AND begins_with(SK, :recipeIdPrefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':recipeIdPrefix': `${recipeId}#`,
      },
    });

    const ingredientsResult = await dynamoDbClient.send(queryIngredientsCommand);
    const ingredients = (ingredientsResult.Items || []) as RecipeIngredient[];

    // Combine recipe and ingredients
    const response: RecipeDetailResponse = {
      ...recipe,
      ingredients,
    };

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching recipe:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'An unexpected error occurred while fetching the recipe',
          details: null,
        },
      }),
    };
  }
};
