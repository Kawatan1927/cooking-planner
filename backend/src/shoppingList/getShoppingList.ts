import type { Context } from 'hono';
import { listMenusInRange } from '../menus/repository';
import { findRecipeWithIngredients, RecipeWithIngredients } from '../recipes/repository';
import { HandlerResult, badRequest, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';
import { isNonEmptyString, isValidDate } from '../shared/validation';

const USER_ID_LOG_PREFIX_LENGTH = 12;

type ShoppingListItem = {
  ingredientName: string;
  totalQuantity: number | string;
  unit: string;
};

const roundQuantity = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const buildAggregationKey = (ingredientName: string, unit: string): string =>
  `${ingredientName} ${unit}`;

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
  return `${roundQuantity(aggregate.totalNumeric)} + ${texts.join(' + ')}`;
};

/**
 * GET /shopping-list?from&to
 * 指定期間の献立から必要な材料を集計して返す。
 *
 * 集計ルール:
 * - quantity が number の材料は servings / baseServings でスケーリングして合算。
 * - quantity が string の材料はスケーリングせず、同一キー内で ` + ` 連結（重複除外）。
 * - number と string が混在する場合は "<number> + <string>" 文字列で返す。
 */
export const getShoppingList = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);

    const from = c.req.query('from');
    const to = c.req.query('to');

    if (!isNonEmptyString(from)) {
      return badRequest('"from" query parameter is required');
    }
    if (!isNonEmptyString(to)) {
      return badRequest('"to" query parameter is required');
    }
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
      `Computing shopping list for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}..., from: ${from}, to: ${to}`
    );

    const menus = await listMenusInRange(userId, from, to);

    const recipeCache = new Map<string, RecipeWithIngredients | null>();
    const aggregated = new Map<string, AggregatedItem>();

    for (const menu of menus) {
      const recipeId = menu.recipeId;

      let data = recipeCache.get(recipeId);
      if (data === undefined) {
        data = await findRecipeWithIngredients(userId, recipeId);
        recipeCache.set(recipeId, data);
      }

      if (!data) {
        console.error('Recipe referenced by menu was not found', {
          recipeId,
          menuId: menu.menuId,
        });
        return internalServerError('Failed to compute shopping list');
      }

      const { recipe, ingredients } = data;
      if (typeof recipe.baseServings !== 'number' || recipe.baseServings <= 0) {
        console.error('Invalid baseServings on recipe', {
          recipeId,
          baseServings: recipe.baseServings,
        });
        return internalServerError('Failed to compute shopping list');
      }

      const scale = menu.servings / recipe.baseServings;

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

    return jsonResponse(200, { from, to, items });
  } catch (error) {
    console.error('Error computing shopping list:', error);
    return internalServerError('Failed to compute shopping list');
  }
};
