/**
 * useRecipes - レシピ一覧を取得するカスタムフック
 *
 * React Query を使用してレシピ一覧を取得します。
 */

import { useQuery } from '@tanstack/react-query';
import { useAuthToken } from '@/features/auth';
import { getRecipes } from '../api/recipes';
import type { Recipe } from '../types';
import { getUserCacheKey, recipesQueryKeys } from './queryKeys';

/**
 * レシピ一覧を取得するフックのオプション
 */
export interface UseRecipesOptions {
  /**
   * クエリキー分離用のユーザー識別子
   * 未指定時は認証トークンから自動導出します
   */
  userCacheKey?: string | null;

  /**
   * React Query の enabled オプション
   * デフォルトでは token が存在する場合のみクエリを実行します
   */
  enabled?: boolean;
}

/**
 * レシピ一覧を取得するカスタムフック
 *
 * @param options - フックのオプション
 * @returns React Query の結果オブジェクト
 *
 * @example
 * ```tsx
 * function RecipeList() {
 *   const { data: recipes, isLoading, error } = useRecipes();
 *
 *   if (isLoading) return <div>読み込み中...</div>;
 *   if (error) return <div>エラーが発生しました</div>;
 *
 *   return (
 *     <ul>
 *       {recipes?.map((recipe) => (
 *         <li key={recipe.recipeId}>{recipe.name}</li>
 *       ))}
 *     </ul>
 *   );
 * }
 * ```
 */
export function useRecipes({ userCacheKey, enabled = true }: UseRecipesOptions = {}) {
  const token = useAuthToken();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useQuery<Recipe[], Error>({
    queryKey: recipesQueryKeys.list(cacheUserKey),
    queryFn: async () => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }
      return getRecipes();
    },
    enabled: enabled && !!token,
  });
}
