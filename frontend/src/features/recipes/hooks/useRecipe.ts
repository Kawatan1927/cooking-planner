/**
 * useRecipe - 特定レシピの詳細を取得するカスタムフック
 *
 * React Query を使用してレシピ詳細（材料を含む）を取得します。
 */

import { useQuery } from '@tanstack/react-query';
import { getRecipe } from '../api/recipes';
import type { RecipeDetail } from '../types';
import { getUserCacheKey, recipesQueryKeys } from './queryKeys';

/**
 * レシピ詳細を取得するフックのオプション
 */
export interface UseRecipeOptions {
  /**
   * レシピID
   */
  recipeId: string;

  /**
   * 認証トークン
   * 認証が必要なため、必須パラメータです
   */
  token: string | null;
  /**
   * クエリキー分離用のユーザー識別子
   * 未指定時は token から自動導出します
   */
  userCacheKey?: string | null;

  /**
   * React Query の enabled オプション
   * デフォルトでは recipeId と token が存在する場合のみクエリを実行します
   */
  enabled?: boolean;
}

/**
 * レシピ詳細を取得するカスタムフック
 *
 * @param options - フックのオプション
 * @returns React Query の結果オブジェクト
 *
 * @example
 * ```tsx
 * function RecipeDetailPage({ recipeId }: { recipeId: string }) {
 *   const token = useAuthToken(); // 認証トークンを取得する仮のフック
 *   const { data: recipe, isLoading, error } = useRecipe({ recipeId, token });
 *
 *   if (isLoading) return <div>読み込み中...</div>;
 *   if (error) return <div>エラーが発生しました</div>;
 *   if (!recipe) return <div>レシピが見つかりません</div>;
 *
 *   return (
 *     <div>
 *       <h1>{recipe.name}</h1>
 *       <p>基本人数: {recipe.baseServings}人分</p>
 *       <h2>材料</h2>
 *       <ul>
 *         {recipe.ingredients.map((ingredient, index) => (
 *           <li key={index}>
 *             {ingredient.ingredientName}: {ingredient.quantity} {ingredient.unit}
 *           </li>
 *         ))}
 *       </ul>
 *     </div>
 *   );
 * }
 * ```
 */
export function useRecipe({ recipeId, token, userCacheKey, enabled = true }: UseRecipeOptions) {
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useQuery<RecipeDetail, Error>({
    queryKey: recipesQueryKeys.detail(cacheUserKey, recipeId),
    queryFn: async () => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }
      return getRecipe(recipeId, token);
    },
    enabled: enabled && !!token && !!recipeId,
  });
}
