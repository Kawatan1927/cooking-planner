import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient } from '@aws-sdk/lib-dynamodb';

/**
 * DynamoDB client configuration
 */

const client = new DynamoDBClient({});

export const dynamoDbClient = DynamoDBDocumentClient.from(client, {
  marshallOptions: {
    removeUndefinedValues: true,
    convertClassInstanceToMap: true,
  },
  unmarshallOptions: {
    wrapNumbers: false,
  },
});

/**
 * Table names from environment variables
 */
export const TABLE_NAMES = {
  RECIPES: process.env.RECIPES_TABLE_NAME || '',
  RECIPE_INGREDIENTS: process.env.RECIPE_INGREDIENTS_TABLE_NAME || '',
  MENUS: process.env.MENUS_TABLE_NAME || '',
  PANTRY_ITEMS: process.env.PANTRY_ITEMS_TABLE_NAME || '',
} as const;
