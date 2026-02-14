/**
 * Recipes API クライアント
 *
 * docs/04-api-design.md に定義された Recipes API のラッパー関数を提供します。
 * すべての関数は lib/apiClient.ts の apiFetch を使用して実装されています。
 */

import { apiFetch } from '@/lib/apiClient';
import type {
  RecipeSummary,
  RecipeDetail,
  RecipeInput,
  CreateRecipeResponse,
  UpdateRecipeResponse,
} from '../types';

/**
 * レシピ一覧を取得する
 *
 * GET /recipes
 *
 * @param token - JWT認証トークン
 * @returns Promise<RecipeSummary[]> - レシピ一覧
 */
export async function list(token: string): Promise<RecipeSummary[]> {
  return apiFetch<RecipeSummary[]>('/recipes', {
    method: 'GET',
    token,
  });
}

/**
 * 特定のレシピの詳細を取得する
 *
 * GET /recipes/{recipeId}
 *
 * @param recipeId - レシピID
 * @param token - JWT認証トークン
 * @returns Promise<RecipeDetail> - レシピ詳細（材料を含む）
 */
export async function get(recipeId: string, token: string): Promise<RecipeDetail> {
  return apiFetch<RecipeDetail>(`/recipes/${recipeId}`, {
    method: 'GET',
    token,
  });
}

/**
 * 新しいレシピを作成する
 *
 * POST /recipes
 *
 * @param input - レシピ作成データ（名前、材料など）
 * @param token - JWT認証トークン
 * @returns Promise<CreateRecipeResponse> - 作成されたレシピのID
 */
export async function create(input: RecipeInput, token: string): Promise<CreateRecipeResponse> {
  return apiFetch<CreateRecipeResponse>('/recipes', {
    method: 'POST',
    body: input,
    token,
  });
}

/**
 * 既存のレシピを更新する
 *
 * PUT /recipes/{recipeId}
 *
 * @param recipeId - 更新するレシピのID
 * @param input - 更新データ（名前、材料など）
 * @param token - JWT認証トークン
 * @returns Promise<UpdateRecipeResponse> - 更新されたレシピのID
 */
export async function update(
  recipeId: string,
  input: RecipeInput,
  token: string
): Promise<UpdateRecipeResponse> {
  return apiFetch<UpdateRecipeResponse>(`/recipes/${recipeId}`, {
    method: 'PUT',
    body: input,
    token,
  });
}
