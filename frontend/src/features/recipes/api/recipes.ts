/**
 * レシピAPI呼び出しのラッパー関数
 *
 * apiFetch を使用して、レシピ関連のAPIエンドポイントを呼び出します。
 * docs/docs/features/api-design.md の仕様に基づいています。
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
 * @returns Promise<Recipe[]> - レシピの配列
 */
export async function getRecipes(): Promise<Recipe[]> {
  return apiFetch<Recipe[]>('/recipes', {
    method: 'GET',
  });
}

/**
 * レシピ詳細を取得する
 * GET /recipes/{recipeId}
 *
 * @param recipeId - レシピID
 * @returns Promise<RecipeDetail> - レシピ詳細（材料を含む）
 */
export async function getRecipe(recipeId: string): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>(`/recipes/${recipeId}`, {
    method: 'GET',
  });
}

/**
 * レシピを作成する
 * POST /recipes
 *
 * @param data - レシピ作成リクエストデータ
 * @returns Promise<CreateRecipeResponse> - 作成されたレシピのID
 */
export async function createRecipe(data: CreateRecipeRequest): Promise<CreateRecipeResponse> {
  return apiFetch<CreateRecipeResponse>('/recipes', {
    method: 'POST',
    body: data,
  });
}

/**
 * レシピを更新する
 * PUT /recipes/{recipeId}
 *
 * @param recipeId - レシピID
 * @param data - レシピ更新リクエストデータ
 * @returns Promise<UpdateRecipeResponse> - 更新されたレシピのID
 */
export async function updateRecipe(
  recipeId: string,
  data: UpdateRecipeRequest
): Promise<UpdateRecipeResponse> {
  return apiFetch<UpdateRecipeResponse>(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: data,
  });
}
