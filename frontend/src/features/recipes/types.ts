/**
 * レシピ関連の型定義
 *
 * docs/03-domain-and-data-model.md および docs/04-api-design.md に基づく
 */

/**
 * レシピの材料
 */
export interface RecipeIngredient {
  ingredientName: string;
  quantity: number;
  unit: string;
  note?: string | null;
}

/**
 * レシピの基本情報（一覧表示用）
 */
export interface RecipeSummary {
  recipeId: string;
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * レシピの詳細情報（材料を含む）
 */
export interface RecipeDetail extends RecipeSummary {
  memo?: string | null;
  ingredients: RecipeIngredient[];
}

/**
 * レシピ作成・更新時のリクエストボディ
 */
export interface RecipeInput {
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  ingredients: RecipeIngredient[];
}

/**
 * レシピ作成時のレスポンス
 */
export interface CreateRecipeResponse {
  recipeId: string;
}

/**
 * レシピ更新時のレスポンス
 */
export interface UpdateRecipeResponse {
  recipeId: string;
}
