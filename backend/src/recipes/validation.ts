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

type RecipeBodyValidationResult =
  | { success: true; body: RecipeBody }
  | { success: false; error: HandlerResult };

const isOptionalNullableString = (value: unknown): value is string | null | undefined =>
  value === undefined || value === null || typeof value === 'string';

const isOptionalNullableFiniteNumber = (value: unknown): value is number | null | undefined =>
  value === undefined || value === null || (typeof value === 'number' && Number.isFinite(value));

const invalidRecipeBody = (message: string): RecipeBodyValidationResult => ({
  success: false,
  error: badRequest(message),
});

/**
 * POST/PUT /recipes のリクエストボディを検証する。
 * 問題があれば HandlerResult（400）を、なければ型付け済みのbodyを返す。
 */
export const validateRecipeBody = (body: unknown): RecipeBodyValidationResult => {
  if (typeof body !== 'object' || body === null || Array.isArray(body)) {
    return invalidRecipeBody('Request body must be an object');
  }

  const recipe = body as Record<string, unknown>;
  if (!isNonEmptyString(recipe.name)) {
    return invalidRecipeBody('Recipe name is required');
  }
  if (!isPositiveNumber(recipe.baseServings)) {
    return invalidRecipeBody('baseServings must be a positive number');
  }
  if (!isOptionalNullableString(recipe.sourceBook)) {
    return invalidRecipeBody('sourceBook must be a string or null');
  }
  if (!isOptionalNullableFiniteNumber(recipe.sourcePage)) {
    return invalidRecipeBody('sourcePage must be a finite number or null');
  }
  if (!isOptionalNullableString(recipe.memo)) {
    return invalidRecipeBody('memo must be a string or null');
  }
  if (!Array.isArray(recipe.ingredients)) {
    return invalidRecipeBody('ingredients must be an array');
  }

  const seenNames = new Set<string>();
  const ingredients: RecipeBody['ingredients'] = [];
  for (const ingredient of recipe.ingredients) {
    if (typeof ingredient !== 'object' || ingredient === null || Array.isArray(ingredient)) {
      return invalidRecipeBody('Each ingredient must be an object');
    }

    const recipeIngredient = ingredient as Record<string, unknown>;
    if (!isNonEmptyString(recipeIngredient.ingredientName)) {
      return invalidRecipeBody('Each ingredient must have a valid ingredientName');
    }
    const normalized = recipeIngredient.ingredientName.toLowerCase().trim();
    if (seenNames.has(normalized)) {
      return invalidRecipeBody(`Duplicate ingredient name: ${recipeIngredient.ingredientName}`);
    }
    seenNames.add(normalized);

    const quantity = recipeIngredient.quantity;
    if (
      !isPositiveNumber(quantity) &&
      !(typeof quantity === 'string' && quantity.trim().length > 0)
    ) {
      return invalidRecipeBody(
        'Each ingredient must have a positive numeric quantity or a non-empty text quantity'
      );
    }
    if (!isNonEmptyString(recipeIngredient.unit)) {
      return invalidRecipeBody('Each ingredient must have a unit');
    }
    if (!isOptionalNullableString(recipeIngredient.note)) {
      return invalidRecipeBody('Each ingredient note must be a string or null');
    }

    ingredients.push({
      ingredientName: recipeIngredient.ingredientName,
      quantity,
      unit: recipeIngredient.unit,
      note: recipeIngredient.note,
    });
  }

  return {
    success: true,
    body: {
      name: recipe.name,
      sourceBook: recipe.sourceBook,
      sourcePage: recipe.sourcePage,
      baseServings: recipe.baseServings,
      memo: recipe.memo,
      ingredients,
    },
  };
};
