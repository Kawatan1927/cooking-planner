/**
 * レシピ関連の型定義
 *
 * API レスポンスとドメインモデルの型を定義します。
 * docs/03-domain-and-data-model.md および docs/04-api-design.md に基づいています。
 */

/**
 * レシピ一覧で取得されるレシピの型
 * GET /recipes のレスポンス配列の要素
 */
export interface Recipe {
  recipeId: string;
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * レシピの材料の型
 */
export interface RecipeIngredient {
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note?: string | null;
}

/**
 * レシピ詳細の型
 * GET /recipes/{recipeId} のレスポンス
 */
export interface RecipeDetail extends Recipe {
  memo?: string | null;
  ingredients: RecipeIngredient[];
}

/**
 * レシピ作成時のリクエストボディの型
 * POST /recipes
 */
export interface CreateRecipeRequest {
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  ingredients: RecipeIngredient[];
}

/**
 * レシピ作成時のレスポンスの型
 */
export interface CreateRecipeResponse {
  recipeId: string;
}

/**
 * レシピ更新時のリクエストボディの型
 * PUT /recipes/{recipeId}
 */
export interface UpdateRecipeRequest {
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  ingredients: RecipeIngredient[];
}

/**
 * レシピ更新時のレスポンスの型
 */
export interface UpdateRecipeResponse {
  recipeId: string;
}
