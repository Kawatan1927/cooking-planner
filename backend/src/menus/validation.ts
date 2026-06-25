import { HandlerResult, badRequest } from '../shared/http';
import { isNonEmptyString, isPositiveNumber, isValidDate } from '../shared/validation';

export const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'OTHER'] as const;
export type MealType = (typeof VALID_MEAL_TYPES)[number];

export interface MenuBody {
  date: string;
  mealType: string;
  recipeId: string;
  servings: number;
  memo?: string | null;
}

const isValidMealType = (mealType: string): mealType is MealType =>
  (VALID_MEAL_TYPES as readonly string[]).includes(mealType);

/**
 * POST/PUT /menus のリクエストボディを検証する。
 * 問題があれば HandlerResult（400）を、なければ null を返す。
 */
export const validateMenuBody = (body: MenuBody): HandlerResult | null => {
  if (!isNonEmptyString(body.date) || !isValidDate(body.date)) {
    return badRequest('Invalid "date" format. Use YYYY-MM-DD');
  }
  if (!isNonEmptyString(body.mealType) || !isValidMealType(body.mealType)) {
    return badRequest('Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER');
  }
  if (!isNonEmptyString(body.recipeId)) {
    return badRequest('"recipeId" is required');
  }
  if (!isPositiveNumber(body.servings)) {
    return badRequest('"servings" must be a positive number');
  }
  return null;
};
