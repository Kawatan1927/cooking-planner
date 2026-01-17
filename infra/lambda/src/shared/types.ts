/**
 * Common types used across Lambda functions
 */

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details: unknown;
  };
}

export interface Recipe {
  recipeId: string;
  userId: string;
  name: string;
  sourceBook?: string;
  sourcePage?: number;
  baseServings: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RecipeIngredient {
  userId: string;
  recipeId: string;
  ingredientName: string;
  quantity: number;
  unit: string;
  note?: string;
}

export interface Menu {
  menuId: string;
  userId: string;
  date: string; // YYYY-MM-DD
  mealType: 'BREAKFAST' | 'LUNCH' | 'DINNER';
  recipeId: string;
  servings: number;
  memo?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Request/Response types for POST /recipes
 */
export interface CreateRecipeRequest {
  name: string;
  sourceBook?: string;
  sourcePage?: number;
  baseServings: number;
  memo?: string;
  ingredients: {
    ingredientName: string;
    quantity: number;
    unit: string;
    note?: string;
  }[];
}

export interface CreateRecipeResponse {
  recipeId: string;
}
