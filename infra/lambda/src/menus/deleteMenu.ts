import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { DeleteCommand } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { findMenuByMenuId } from './utils';
import { badRequest, internalServerError, notFound, unauthorized } from '../shared/http';

const USER_ID_LOG_PREFIX_LENGTH = 12;

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
      return unauthorized('User ID not found in token');
    }

    const userId = subClaim;
    const menuId = event.pathParameters?.menuId;

    if (!menuId) {
      return badRequest('Menu ID is required');
    }

    console.log(
      `Deleting menu ${menuId} for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`
    );

    const existingMenu = await findMenuByMenuId(userId, menuId);

    if (!existingMenu) {
      return notFound('Menu not found', 'MENU_NOT_FOUND');
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
      return internalServerError('Menus table not found', 'RESOURCE_NOT_FOUND');
    }

    if (errorName === 'AccessDeniedException') {
      return internalServerError('Access denied while deleting menu', 'ACCESS_DENIED');
    }

    return internalServerError('Failed to delete menu');
  }
};
