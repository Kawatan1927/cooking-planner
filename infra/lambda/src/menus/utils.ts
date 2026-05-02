import { QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Menu } from '../shared/types';

export interface MenuItemWithSK extends Menu {
  SK: string;
}

/**
 * Find a menu item by menuId for the given user.
 * Queries the Menus table by userId (PK) and filters by menuId.
 */
export const findMenuByMenuId = async (
  userId: string,
  menuId: string
): Promise<MenuItemWithSK | null> => {
  let exclusiveStartKey: QueryCommandInput['ExclusiveStartKey'];

  do {
    const result = await dynamoDbClient.send(
      new QueryCommand({
        TableName: TABLE_NAMES.MENUS,
        KeyConditionExpression: 'userId = :userId',
        FilterExpression: 'menuId = :menuId',
        ExpressionAttributeValues: {
          ':userId': userId,
          ':menuId': menuId,
        },
        ExclusiveStartKey: exclusiveStartKey,
      })
    );

    if (result.Items && result.Items.length > 0) {
      return result.Items[0] as MenuItemWithSK;
    }

    exclusiveStartKey = result.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return null;
};
