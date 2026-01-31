/**
 * Recipe 関連の型定義
 */

/**
 * レシピの基本情報
 * GET /recipes のレスポンス配列の要素型
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
 * レシピ一覧の取得レスポンス型
 */
export type RecipesResponse = Recipe[];
