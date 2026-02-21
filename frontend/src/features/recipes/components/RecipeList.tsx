/**
 * RecipeList - レシピ一覧を表示するコンポーネントのサンプル
 *
 * useRecipes フックの使用例を示すコンポーネントです。
 */

import { useRecipes } from '../hooks';

interface RecipeListProps {
  /**
   * 認証トークン
   */
  token: string | null;
}

/**
 * レシピ一覧を表示するサンプルコンポーネント
 *
 * @example
 * ```tsx
 * function App() {
 *   const token = useAuthToken(); // 認証トークンを取得
 *   return <RecipeList token={token} />;
 * }
 * ```
 */
export function RecipeList({ token }: RecipeListProps) {
  const { data: recipes, isLoading, error } = useRecipes({ token });

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

  if (!recipes || recipes.length === 0) {
    return <div>レシピが登録されていません</div>;
  }

  return (
    <div>
      <h1>レシピ一覧</h1>
      <ul>
        {recipes.map(recipe => (
          <li key={recipe.recipeId}>
            <h2>{recipe.name}</h2>
            <p>基本人数: {recipe.baseServings}人分</p>
            {recipe.sourceBook && <p>出典: {recipe.sourceBook}</p>}
            {recipe.sourcePage && <p>ページ: {recipe.sourcePage}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}
