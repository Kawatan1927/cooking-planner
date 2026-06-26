import { HandlerResult, badRequest } from '../shared/http';
import { isNonEmptyString, isPositiveNumber } from '../shared/validation';

export interface RecipeBody {
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  ingredients: Array<{
    ingredientName: string;
    quantity: number | string;
    unit: string;
    note?: string | null;
  }>;
}

/**
 * POST/PUT /recipes のリクエストボディを検証する。
 * 問題があれば HandlerResult（400）を、なければ null を返す。
 */
export const validateRecipeBody = (body: RecipeBody): HandlerResult | null => {
  if (!isNonEmptyString(body.name)) {
    return badRequest('Recipe name is required');
  }
  if (!isPositiveNumber(body.baseServings)) {
    return badRequest('baseServings must be a positive number');
  }
  if (!Array.isArray(body.ingredients)) {
    return badRequest('ingredients must be an array');
  }

  const seenNames = new Set<string>();
  for (const ingredient of body.ingredients) {
    if (typeof ingredient !== 'object' || ingredient === null || Array.isArray(ingredient)) {
      return badRequest('Each ingredient must be an object');
    }
    if (!isNonEmptyString(ingredient.ingredientName)) {
      return badRequest('Each ingredient must have a valid ingredientName');
    }
    const normalized = ingredient.ingredientName.toLowerCase().trim();
    if (seenNames.has(normalized)) {
      return badRequest(`Duplicate ingredient name: ${ingredient.ingredientName}`);
    }
    seenNames.add(normalized);

    const hasValidNumericQuantity =
      typeof ingredient.quantity === 'number' && ingredient.quantity > 0;
    const hasValidTextQuantity =
      typeof ingredient.quantity === 'string' && ingredient.quantity.trim().length > 0;
    if (!hasValidNumericQuantity && !hasValidTextQuantity) {
      return badRequest(
        'Each ingredient must have a positive numeric quantity or a non-empty text quantity'
      );
    }
    if (!isNonEmptyString(ingredient.unit)) {
      return badRequest('Each ingredient must have a unit');
    }
  }

  return null;
};
