/**
 * RecipeDetail - レシピ詳細を表示するコンポーネントのサンプル
 *
 * useRecipe フックの使用例を示すコンポーネントです。
 */

import { useRecipe } from '../hooks';

interface RecipeDetailProps {
  /**
   * レシピID
   */
  recipeId: string;
}

/**
 * レシピ詳細を表示するサンプルコンポーネント
 *
 * @example
 * ```tsx
 * function RecipePage({ recipeId }: { recipeId: string }) {
 *   return <RecipeDetail recipeId={recipeId} />;
 * }
 * ```
 */
export function RecipeDetail({ recipeId }: RecipeDetailProps) {
  const { data: recipe, isLoading, error } = useRecipe({ recipeId });

  if (isLoading) {
    return <div>読み込み中...</div>;
  }

  if (error) {
    return (
      <div>
        <p>エラーが発生しました</p>
        <p>{error.message}</p>
      </div>
    );
  }

  if (!recipe) {
    return <div>レシピが見つかりません</div>;
  }

  return (
    <div>
      <h1>{recipe.name}</h1>

      <div>
        <p>基本人数: {recipe.baseServings}人分</p>
        {recipe.sourceBook && <p>出典: {recipe.sourceBook}</p>}
        {recipe.sourcePage && <p>ページ: {recipe.sourcePage}</p>}
        {recipe.memo && (
          <div>
            <h3>メモ</h3>
            <p>{recipe.memo}</p>
          </div>
        )}
      </div>

      <div>
        <h2>材料</h2>
        {recipe.ingredients.length === 0 ? (
          <p>材料が登録されていません</p>
        ) : (
          <ul>
            {recipe.ingredients.map((ingredient, index) => (
              <li key={index}>
                {ingredient.ingredientName}: {ingredient.quantity} {ingredient.unit}
                {ingredient.note && <span> ({ingredient.note})</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div>
        <p>作成日時: {new Date(recipe.createdAt).toLocaleString('ja-JP')}</p>
        <p>更新日時: {new Date(recipe.updatedAt).toLocaleString('ja-JP')}</p>
      </div>
    </div>
  );
}
