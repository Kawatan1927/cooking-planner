/**
 * Recipes API クライアント
 */

import { apiFetch } from '../../../lib/apiClient';
import type { RecipesResponse } from '../types';

/**
 * レシピ一覧を取得する
 * GET /recipes
 *
 * @param token - 認証トークン（JWT）
 * @returns レシピ一覧
 */
export async function fetchRecipes(token: string | null): Promise<RecipesResponse> {
  return apiFetch<RecipesResponse>('/recipes', {
    method: 'GET',
    token,
  });
}
