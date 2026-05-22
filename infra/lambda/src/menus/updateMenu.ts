import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { PutCommand, TransactWriteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { findMenuByMenuId, MenuItemWithSK } from './utils';
import {
  badRequest,
  internalServerError,
  jsonResponse,
  notFound,
  unauthorized,
} from '../shared/http';
import { isNonEmptyString, isPositiveNumber, isValidDate } from '../shared/validation';

const USER_ID_LOG_PREFIX_LENGTH = 12;

const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'OTHER'] as const;
type MealType = (typeof VALID_MEAL_TYPES)[number];

interface UpdateMenuRequestBody {
  date: string;
  mealType: string;
  recipeId: string;
  servings: number;
  memo?: string | null;
}

const isValidMealType = (mealType: string): mealType is MealType =>
  (VALID_MEAL_TYPES as readonly string[]).includes(mealType);

/**
 * PUT /menus/{menuId}
 * Update an existing menu item for the logged-in user
 */
export const updateMenu = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const subClaim = event.requestContext.authorizer?.jwt?.claims?.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return unauthorized('User ID not found in token');
    }

    const userId = subClaim;
    const menuId = event.pathParameters?.menuId;

    if (!menuId) {
      return badRequest('Menu ID is required');
    }

    if (!event.body) {
      return badRequest('Request body is required');
    }

    let requestBody: UpdateMenuRequestBody;
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

    console.log(
      `Updating menu ${menuId} for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    const existingMenu = await findMenuByMenuId(userId, menuId);

    if (!existingMenu) {
      return notFound('Menu not found', 'MENU_NOT_FOUND');
    }

    const newSK = `${requestBody.date}#${requestBody.mealType}#${menuId}`;
    const now = new Date().toISOString();

    const updatedMenu: MenuItemWithSK = {
      userId,
      SK: newSK,
      date: requestBody.date,
      mealType: requestBody.mealType as MealType,
      menuId,
      recipeId: requestBody.recipeId,
      servings: requestBody.servings,
      memo: requestBody.memo ?? undefined,
      createdAt: existingMenu.createdAt,
      updatedAt: now,
    };

    if (existingMenu.SK !== newSK) {
      await dynamoDbClient.send(
        new TransactWriteCommand({
          TransactItems: [
            {
              Delete: {
                TableName: TABLE_NAMES.MENUS,
                Key: { userId, SK: existingMenu.SK },
                ConditionExpression: 'attribute_exists(userId) AND attribute_exists(SK)',
              },
            },
            {
              Put: {
                TableName: TABLE_NAMES.MENUS,
                Item: updatedMenu,
                ConditionExpression: 'attribute_not_exists(userId) AND attribute_not_exists(SK)',
              },
            },
          ],
        })
      );
    } else {
      await dynamoDbClient.send(
        new PutCommand({
          TableName: TABLE_NAMES.MENUS,
          Item: updatedMenu,
          ConditionExpression: 'attribute_exists(userId) AND attribute_exists(SK)',
        })
      );
    }

    console.log(`Menu updated: ${menuId}`);

    return jsonResponse(200, { menuId });
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error updating menu:', { errorName, error });

    if (errorName === 'ResourceNotFoundException') {
      return internalServerError('Menus table not found', 'RESOURCE_NOT_FOUND');
    }

    if (errorName === 'AccessDeniedException') {
      return internalServerError('Access denied while updating menu', 'ACCESS_DENIED');
    }

    return internalServerError('Failed to update menu');
  }
};
