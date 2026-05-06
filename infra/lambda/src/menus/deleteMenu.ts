import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { findMenuByMenuId } from './utils';

const USER_ID_LOG_PREFIX_LENGTH = 12;

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

/**
 * DELETE /menus/{menuId}
 * Delete a menu item for the logged-in user
 */
export const deleteMenu = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const subClaim = event.requestContext.authorizer?.jwt?.claims?.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User ID not found in token');
    }

    const userId = subClaim;
    const menuId = event.pathParameters?.menuId;

    if (!menuId) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Menu ID is required');
    }

    console.log(
      `Deleting menu ${menuId} for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    const existingMenu = await findMenuByMenuId(userId, menuId);

    if (!existingMenu) {
      return createErrorResponse(404, 'MENU_NOT_FOUND', 'Menu not found');
    }

    await dynamoDbClient.send(
      new DeleteCommand({
        TableName: TABLE_NAMES.MENUS,
        Key: { userId, SK: existingMenu.SK },
      })
    );

    console.log(`Menu deleted: ${menuId}`);

    return {
      statusCode: 204,
      headers: { 'Content-Type': 'application/json' },
      body: '',
    };
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error deleting menu:', { errorName, error });

    if (errorName === 'ResourceNotFoundException') {
      return createErrorResponse(500, 'RESOURCE_NOT_FOUND', 'Menus table not found');
    }

    if (errorName === 'AccessDeniedException') {
      return createErrorResponse(500, 'ACCESS_DENIED', 'Access denied while deleting menu');
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to delete menu');
  }
};
