/**
 * useCreateRecipe - レシピを作成するカスタムフック
 *
 * React Query の useMutation を使用して POST /recipes を呼び出します。
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createRecipe } from '../api/recipes';
import type { CreateRecipeRequest, CreateRecipeResponse } from '../types';
import { getUserCacheKey, recipesQueryKeys } from './queryKeys';

/**
 * レシピ作成フックのオプション
 */
export interface UseCreateRecipeOptions {
  /**
   * 認証トークン
   */
  token: string | null;

  /**
   * クエリキー分離用のユーザー識別子
   */
  userCacheKey?: string | null;

  /**
   * 作成成功時のコールバック
   */
  onSuccess?: (data: CreateRecipeResponse) => void;
}

/**
 * レシピを作成するカスタムフック
 *
 * @param options - フックのオプション
 * @returns useMutation の結果オブジェクト
 *
 * @example
 * ```tsx
 * function RecipeNewPage() {
 *   const token = useAuthToken();
 *   const navigate = useNavigate();
 *   const { mutate, isPending } = useCreateRecipe({
 *     token,
 *     onSuccess: ({ recipeId }) => navigate(`/recipes/${recipeId}`),
 *   });
 *
 *   const handleSubmit = (data: CreateRecipeRequest) => mutate(data);
 * }
 * ```
 */
export function useCreateRecipe({ token, userCacheKey, onSuccess }: UseCreateRecipeOptions) {
  const queryClient = useQueryClient();
  const cacheUserKey = getUserCacheKey(token, userCacheKey);

  return useMutation<CreateRecipeResponse, Error, CreateRecipeRequest>({
    mutationFn: (data: CreateRecipeRequest) => {
      if (!token) {
        throw new Error('認証トークンが必要です');
      }
      return createRecipe(data, token);
    },
    onSuccess: data => {
      // レシピ一覧のキャッシュを無効化
      queryClient.invalidateQueries({ queryKey: recipesQueryKeys.list(cacheUserKey) });
      onSuccess?.(data);
    },
  });
}
