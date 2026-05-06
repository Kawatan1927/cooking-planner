import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { MenuItemWithSK } from './utils';
import { randomUUID } from 'crypto';

const USER_ID_LOG_PREFIX_LENGTH = 12;

const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'OTHER'] as const;
type MealType = (typeof VALID_MEAL_TYPES)[number];

interface CreateMenuRequestBody {
  date: string;
  mealType: string;
  recipeId: string;
  servings: number;
  memo?: string | null;
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

const isValidDateFormat = (date: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(date);

const isValidMealType = (mealType: string): mealType is MealType =>
  (VALID_MEAL_TYPES as readonly string[]).includes(mealType);

/**
 * POST /menus
 * Create a new menu item for the logged-in user
 */
export const createMenu = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const subClaim = event.requestContext.authorizer?.jwt?.claims?.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User ID not found in token');
    }

    const userId = subClaim;

    if (!event.body) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Request body is required');
    }

    let requestBody: CreateMenuRequestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      return createErrorResponse(400, 'BAD_REQUEST', 'Invalid JSON in request body');
    }

    if (!requestBody.date || !isValidDateFormat(requestBody.date)) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Invalid "date" format. Use YYYY-MM-DD');
    }

    if (!requestBody.mealType || !isValidMealType(requestBody.mealType)) {
      return createErrorResponse(
        400,
        'BAD_REQUEST',
        'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER'
      );
    }

    if (!requestBody.recipeId || typeof requestBody.recipeId !== 'string') {
      return createErrorResponse(400, 'BAD_REQUEST', '"recipeId" is required');
    }

    if (typeof requestBody.servings !== 'number' || requestBody.servings <= 0) {
      return createErrorResponse(400, 'BAD_REQUEST', '"servings" must be a positive number');
    }

    const menuId = randomUUID();
    const now = new Date().toISOString();

    const menuItem: MenuItemWithSK = {
      userId,
      SK: `${requestBody.date}#${requestBody.mealType}#${menuId}`,
      date: requestBody.date,
      mealType: requestBody.mealType as MealType,
      menuId,
      recipeId: requestBody.recipeId,
      servings: requestBody.servings,
      memo: requestBody.memo ?? undefined,
      createdAt: now,
      updatedAt: now,
    };

    console.log(`Creating menu for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

    await dynamoDbClient.send(
      new PutCommand({
        TableName: TABLE_NAMES.MENUS,
        Item: menuItem,
      })
    );

    console.log(`Menu created: ${menuId}`);

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ menuId }),
    };
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error creating menu:', { errorName, error });

    if (errorName === 'ResourceNotFoundException') {
      return createErrorResponse(500, 'RESOURCE_NOT_FOUND', 'Menus table not found');
    }

    if (errorName === 'AccessDeniedException') {
      return createErrorResponse(500, 'ACCESS_DENIED', 'Access denied while creating menu');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to create menu');
  }
};
