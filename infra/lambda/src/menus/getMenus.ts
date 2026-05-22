import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Menu } from '../shared/types';
import { badRequest, internalServerError, jsonResponse, unauthorized } from '../shared/http';
import { isValidDate } from '../shared/validation';

const DEFAULT_PERIOD_DAYS = 7;
const USER_ID_LOG_PREFIX_LENGTH = 12;

const getDefaultDateRange = (): { from: string; to: string } => {
  const today = new Date();
  const toDate = new Date(today);
  toDate.setDate(today.getDate() + DEFAULT_PERIOD_DAYS - 1);

  const formatDate = (d: Date): string => d.toISOString().split('T')[0];

  return {
    from: formatDate(today),
    to: formatDate(toDate),
  };
};

interface MenuItemResponse {
  date: string;
  mealType: string;
  menuId: string;
  recipeId: string;
  servings: number;
}

/**
 * GET /menus
 * Get menus for the logged-in user within a date range
 */
export const getMenus = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const subClaim = event.requestContext.authorizer?.jwt?.claims?.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return unauthorized('User ID not found in token');
    }

    const userId = subClaim;

    const queryParams = event.queryStringParameters ?? {};
    const defaults = getDefaultDateRange();
    const from = queryParams.from ?? defaults.from;
    const to = queryParams.to ?? defaults.to;

    if (!isValidDate(from)) {
      return badRequest('Invalid "from" date format. Use YYYY-MM-DD');
    }

    if (!isValidDate(to)) {
      return badRequest('Invalid "to" date format. Use YYYY-MM-DD');
    }

    if (from > to) {
      return badRequest('"from" date must not be after "to" date');
    }

    console.log(
      `Fetching menus for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}..., from: ${from}, to: ${to}`
    );

    const menus: Menu[] = [];
    let exclusiveStartKey: QueryCommandInput['ExclusiveStartKey'];

    do {
      const result = await dynamoDbClient.send(
        new QueryCommand({
          TableName: TABLE_NAMES.MENUS,
          KeyConditionExpression: 'userId = :userId AND SK BETWEEN :fromSk AND :toSk',
          ExpressionAttributeValues: {
            ':userId': userId,
            ':fromSk': `${from}#`,
            ':toSk': `${to}#\uffff`,
          },
          ExclusiveStartKey: exclusiveStartKey,
        })
      );

      menus.push(...((result.Items ?? []) as Menu[]));
      exclusiveStartKey = result.LastEvaluatedKey;
    } while (exclusiveStartKey);

    const items: MenuItemResponse[] = menus.map(menu => ({
      date: menu.date,
      mealType: menu.mealType,
      menuId: menu.menuId,
      recipeId: menu.recipeId,
      servings: menu.servings,
    }));

    return jsonResponse(200, { from, to, items });
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error fetching menus:', { errorName, error });

    if (errorName === 'ResourceNotFoundException') {
      return internalServerError('Menus table not found', 'RESOURCE_NOT_FOUND');
    }

    if (errorName === 'AccessDeniedException') {
      return internalServerError('Access denied while fetching menus', 'ACCESS_DENIED');
    }

    return internalServerError('Failed to fetch menus');
  }
};
