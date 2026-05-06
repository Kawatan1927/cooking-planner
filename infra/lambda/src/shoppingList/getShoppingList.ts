import { APIGatewayProxyEventV2WithJWTAuthorizer, APIGatewayProxyResultV2 } from 'aws-lambda';
import { GetCommand, QueryCommand, QueryCommandInput } from '@aws-sdk/lib-dynamodb';
import { dynamoDbClient, TABLE_NAMES } from '../shared/dynamodb';
import { Menu, Recipe, RecipeIngredient } from '../shared/types';

const USER_ID_LOG_PREFIX_LENGTH = 12;

type ShoppingListItem = {
  ingredientName: string;
  totalQuantity: number | string;
  unit: string;
};

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

const isValidDateString = (value: string): boolean => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) return false;
  if (month < 1 || month > 12) return false;

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

const roundQuantity = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const buildAggregationKey = (ingredientName: string, unit: string): string =>
  `${ingredientName}\u0000${unit}`;

type AggregatedItem = {
  ingredientName: string;
  unit: string;
  totalNumeric: number;
  textQuantities: Set<string>;
};

const formatTotalQuantity = (aggregate: AggregatedItem): number | string => {
  const hasNumeric = aggregate.totalNumeric !== 0;
  const texts = [...aggregate.textQuantities].filter(Boolean).sort();
  const hasText = texts.length > 0;

  if (hasText && !hasNumeric) {
    return texts.join(' + ');
  }

  if (!hasText) {
    return roundQuantity(aggregate.totalNumeric);
  }

  // numeric + text (例: "400 + 少々")
  return `${roundQuantity(aggregate.totalNumeric)} + ${texts.join(' + ')}`;
};

const fetchMenusInRange = async (userId: string, from: string, to: string): Promise<Menu[]> => {
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

  return menus;
};

const fetchRecipe = async (userId: string, recipeId: string): Promise<Recipe | null> => {
  const result = await dynamoDbClient.send(
    new GetCommand({
      TableName: TABLE_NAMES.RECIPES,
      Key: {
        userId,
        recipeId,
      },
    })
  );

  return (result.Item as Recipe | undefined) ?? null;
};

const fetchIngredients = async (userId: string, recipeId: string): Promise<RecipeIngredient[]> => {
  const result = await dynamoDbClient.send(
    new QueryCommand({
      TableName: TABLE_NAMES.RECIPE_INGREDIENTS,
      KeyConditionExpression: 'userId = :userId AND begins_with(SK, :recipeIdPrefix)',
      ExpressionAttributeValues: {
        ':userId': userId,
        ':recipeIdPrefix': `${recipeId}#`,
      },
    })
  );

  return (result.Items ?? []) as RecipeIngredient[];
};

/**
 * GET /shopping-list?from&to
 * 指定期間の献立から必要な材料を集計して返す。
 *
 * 集計ルール:
 * - quantity が number の材料は `servings / baseServings` でスケーリングし合算する。
 * - quantity が string の材料はスケーリングせず、同一キー内では ` + ` で連結する（重複は除外）。
 * - number と string が混在する場合は `"<number> + <string>"` のような文字列として返す。
 */
export const getShoppingList = async (
  event: APIGatewayProxyEventV2WithJWTAuthorizer
): Promise<APIGatewayProxyResultV2> => {
  try {
    const subClaim = event.requestContext.authorizer?.jwt?.claims?.sub;

    if (typeof subClaim !== 'string' || !subClaim) {
      return createErrorResponse(401, 'UNAUTHORIZED', 'User ID not found in token');
    }

    const userId = subClaim;
    const queryParams = event.queryStringParameters ?? {};

    const from = queryParams.from;
    const to = queryParams.to;

    if (typeof from !== 'string' || from.length === 0) {
      return createErrorResponse(400, 'BAD_REQUEST', '"from" query parameter is required');
    }
    if (typeof to !== 'string' || to.length === 0) {
      return createErrorResponse(400, 'BAD_REQUEST', '"to" query parameter is required');
    }

    if (!isValidDateString(from)) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Invalid "from" date format. Use YYYY-MM-DD');
    }

    if (!isValidDateString(to)) {
      return createErrorResponse(400, 'BAD_REQUEST', 'Invalid "to" date format. Use YYYY-MM-DD');
    }

    if (from > to) {
      return createErrorResponse(400, 'BAD_REQUEST', '"from" date must not be after "to" date');
    }

    console.log(
      `Computing shopping list for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}..., from: ${from}, to: ${to}`
    );

    const menus = await fetchMenusInRange(userId, from, to);

    const recipeCache = new Map<string, Recipe | null>();
    const ingredientsCache = new Map<string, RecipeIngredient[]>();
    const aggregated = new Map<string, AggregatedItem>();

    for (const menu of menus) {
      const recipeId = menu.recipeId;

      let recipe = recipeCache.get(recipeId);
      if (recipe === undefined) {
        recipe = await fetchRecipe(userId, recipeId);
        recipeCache.set(recipeId, recipe);
      }

      if (!recipe) {
        console.error('Recipe referenced by menu was not found', {
          userId,
          recipeId,
          menuId: menu.menuId,
        });
        return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to compute shopping list');
      }

      if (typeof recipe.baseServings !== 'number' || recipe.baseServings <= 0) {
        console.error('Invalid baseServings on recipe', {
          userId,
          recipeId,
          baseServings: recipe.baseServings,
        });
        return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to compute shopping list');
      }

      const scale = menu.servings / recipe.baseServings;

      let ingredients = ingredientsCache.get(recipeId);
      if (!ingredients) {
        ingredients = await fetchIngredients(userId, recipeId);
        ingredientsCache.set(recipeId, ingredients);
      }

      for (const ingredient of ingredients) {
        const key = buildAggregationKey(ingredient.ingredientName, ingredient.unit);
        let current = aggregated.get(key);
        if (!current) {
          current = {
            ingredientName: ingredient.ingredientName,
            unit: ingredient.unit,
            totalNumeric: 0,
            textQuantities: new Set<string>(),
          };
          aggregated.set(key, current);
        }

        if (typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity)) {
          current.totalNumeric += ingredient.quantity * scale;
          continue;
        }

        if (typeof ingredient.quantity === 'string') {
          const trimmed = ingredient.quantity.trim();
          if (trimmed.length > 0) {
            current.textQuantities.add(trimmed);
          }
          continue;
        }
      }
    }

    const items: ShoppingListItem[] = [...aggregated.values()]
      .map(aggregate => ({
        ingredientName: aggregate.ingredientName,
        totalQuantity: formatTotalQuantity(aggregate),
        unit: aggregate.unit,
      }))
      .sort((a, b) =>
        a.ingredientName === b.ingredientName
          ? a.unit.localeCompare(b.unit)
          : a.ingredientName.localeCompare(b.ingredientName)
      );

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to, items }),
    };
  } catch (error) {
    const errorName =
      typeof error === 'object' && error !== null && 'name' in error
        ? String(error.name)
        : 'UnknownError';

    console.error('Error computing shopping list:', { errorName, error });

    if (errorName === 'ResourceNotFoundException') {
      return createErrorResponse(500, 'RESOURCE_NOT_FOUND', 'Required table not found');
    }

    if (errorName === 'AccessDeniedException') {
      return createErrorResponse(
        500,
        'ACCESS_DENIED',
        'Access denied while computing shopping list'
      );
    }

    return createErrorResponse(500, 'INTERNAL_SERVER_ERROR', 'Failed to compute shopping list');
  }
};
