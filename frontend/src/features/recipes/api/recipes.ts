/**
 * レシピAPI呼び出しのラッパー関数
 *
 * apiFetch を使用して、レシピ関連のAPIエンドポイントを呼び出します。
 * docs/04-api-design.md の仕様に基づいています。
 */

import { apiFetch } from '@/lib/apiClient';
import type {
  Recipe,
  RecipeDetail,
  CreateRecipeRequest,
  CreateRecipeResponse,
  UpdateRecipeRequest,
  UpdateRecipeResponse,
} from '../types';

/**
 * レシピ一覧を取得する
 * GET /recipes
 *
 * @param token - Authorization ヘッダに使用するトークン
 * @returns Promise<Recipe[]> - レシピの配列
 */
export async function getRecipes(token: string): Promise<Recipe[]> {
  return apiFetch<Recipe[]>('/recipes', {
    method: 'GET',
    token,
  });
}

/**
 * レシピ詳細を取得する
 * GET /recipes/{recipeId}
 *
 * @param recipeId - レシピID
 * @param token - Authorization ヘッダに使用するトークン
 * @returns Promise<RecipeDetail> - レシピ詳細（材料を含む）
 */
export async function getRecipe(recipeId: string, token: string): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>(`/recipes/${recipeId}`, {
    method: 'GET',
    token,
  });
}

/**
 * レシピを作成する
 * POST /recipes
 *
 * @param data - レシピ作成リクエストデータ
 * @param token - Authorization ヘッダに使用するトークン
 * @returns Promise<CreateRecipeResponse> - 作成されたレシピのID
 */
export async function createRecipe(
  data: CreateRecipeRequest,
  token: string
): Promise<CreateRecipeResponse> {
  return apiFetch<CreateRecipeResponse>('/recipes', {
    method: 'POST',
    body: data,
    token,
  });
}

/**
 * レシピを更新する
 * PUT /recipes/{recipeId}
 *
 * @param recipeId - レシピID
 * @param data - レシピ更新リクエストデータ
 * @param token - Authorization ヘッダに使用するトークン
 * @returns Promise<UpdateRecipeResponse> - 更新されたレシピのID
 */
export async function updateRecipe(
  recipeId: string,
  data: UpdateRecipeRequest,
  token: string
): Promise<UpdateRecipeResponse> {
  return apiFetch<UpdateRecipeResponse>(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: data,
    token,
  });
}
