import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeResponse } from '../shared/types';
import { internalServerError, jsonResponse, unauthorized } from '../shared/http';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * GET /recipes
 * Get all recipes for the logged-in user
 */
export const getRecipes = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    // Extract userId from JWT claims
    const subClaim = event.requestContext.authorizer.jwt.claims.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return unauthorized('User ID not found in token');
    }

    const userId = subClaim;

    console.log(
      `Fetching recipes for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    // Query DynamoDB for all recipes belonging to this user
    const result = await dynamoDbClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.RECIPES,
        KeyConditionExpression: 'userId = :userId',
        ExpressionAttributeValues: {
          ':userId': userId,
        },
      })
    );

    const recipes = (result.Items || []) as Recipe[];

    // Format response according to API spec - return only the necessary fields
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
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error fetching recipes:', {
      errorName,
      error,
    });

    if (errorName === 'ResourceNotFoundException') {
      return internalServerError('Recipes table not found', 'RESOURCE_NOT_FOUND');
    }

    if (errorName === 'AccessDeniedException') {
      return internalServerError('Access denied while fetching recipes', 'ACCESS_DENIED');
    }

    return internalServerError('Failed to fetch recipes');
  }
};
