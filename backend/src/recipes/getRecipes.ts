import type { Context } from 'hono';
import { QueryCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Recipe, RecipeResponse } from '../shared/types';
import { HandlerResult, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * GET /recipes
 * Get all recipes for the logged-in user
 */
export const getRecipes = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);

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
