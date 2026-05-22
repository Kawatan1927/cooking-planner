import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { MenuItemWithSK } from './utils';
import { randomUUID } from 'crypto';
import { badRequest, internalServerError, jsonResponse, unauthorized } from '../shared/http';
import { isNonEmptyString, isPositiveNumber, isValidDate } from '../shared/validation';

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
      return unauthorized('User ID not found in token');
    }

    const userId = subClaim;

    if (!event.body) {
      return badRequest('Request body is required');
    }

    let requestBody: CreateMenuRequestBody;
    try {
      requestBody = JSON.parse(event.body);
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    if (!isNonEmptyString(requestBody.date) || !isValidDate(requestBody.date)) {
      return badRequest('Invalid "date" format. Use YYYY-MM-DD');
    }

    if (!isNonEmptyString(requestBody.mealType) || !isValidMealType(requestBody.mealType)) {
      return badRequest('Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER');
    }

    if (!isNonEmptyString(requestBody.recipeId)) {
      return badRequest('"recipeId" is required');
    }

    if (!isPositiveNumber(requestBody.servings)) {
      return badRequest('"servings" must be a positive number');
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

    return jsonResponse(201, { menuId });
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error creating menu:', { errorName, error });

    if (errorName === 'ResourceNotFoundException') {
      return internalServerError('Menus table not found', 'RESOURCE_NOT_FOUND');
    }

    if (errorName === 'AccessDeniedException') {
      return internalServerError('Access denied while creating menu', 'ACCESS_DENIED');
    }

    return internalServerError('Failed to create menu');
  }
};
