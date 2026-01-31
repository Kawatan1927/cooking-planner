/**
 * レシピ一覧取得用 React Query フック
 */

import { useQuery } from '@tanstack/react-query';
import { fetchRecipes } from '../api/fetchRecipes';
import type { RecipesResponse } from '../types';

/**
 * レシピ一覧を取得するフック
 *
 * @param token - 認証トークン（JWT）
 * @returns React Query の結果オブジェクト
 */
export function useRecipes(token: string | null) {
  return useQuery<RecipesResponse>({
    queryKey: ['recipes', token],
    queryFn: () => fetchRecipes(token),
    // トークンがない場合はクエリを実行しない
    enabled: !!token,
  });
}
