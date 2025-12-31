import {
  APIGatewayProxyEventV2WithJWTAuthorizer,
  APIGatewayProxyResultV2,
} from 'aws-lambda';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe } from '../shared/types';

/**
 * GET /recipes
 * Get all recipes for the logged-in user
 */
export const getRecipes = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    // Extract userId from JWT claims
    const userId = event.requestContext.authorizer.jwt.claims.sub as string;
    
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

    console.log(`Fetching recipes for userId: ${userId}`);

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
    const response = recipes.map((recipe) => ({
      recipeId: recipe.recipeId,
      name: recipe.name,
      sourceBook: recipe.sourceBook || null,
      sourcePage: recipe.sourcePage || null,
      baseServings: recipe.baseServings,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    }));

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(response),
    };
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch recipes',
          details: null,
        },
      }),
    };
  }
};
