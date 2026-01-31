/**
 * レシピ一覧ページコンポーネント
 */

import { useNavigate } from 'react-router-dom';
import { useRecipes } from '../hooks/useRecipes';
import { RecipeList } from '../components/RecipeList';

/**
 * レシピ一覧ページ
 *
 * レシピ一覧の取得・表示と、新規作成・詳細表示への導線を提供します。
 */
export function RecipeListPage() {
  const navigate = useNavigate();

  // TODO: 認証実装後は実際のトークンを取得する
  // 現在は開発用として null を渡す（APIが未実装のため）
  const token = null;

  const { data: recipes, isLoading, error } = useRecipes(token);

  // 認証が未実装の場合の表示
  const isAuthNotImplemented = !token;

  const handleRecipeClick = (recipeId: string) => {
    navigate(`/recipes/${recipeId}`);
  };

  const handleNewRecipe = () => {
    navigate('/recipes/new');
  };

  return (
    <div style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem',
        }}
      >
        <h1 style={{ margin: 0 }}>レシピ一覧</h1>
        <button
          onClick={handleNewRecipe}
          style={{
            padding: '0.75rem 1.5rem',
            cursor: 'pointer',
            border: 'none',
            borderRadius: '4px',
            backgroundColor: '#28a745',
            color: 'white',
            fontSize: '1rem',
            fontWeight: 'bold',
          }}
        >
          新規レシピを追加
        </button>
      </div>

      {isLoading && (
        <div style={{ padding: '2rem', textAlign: 'center' }}>
          <p>読み込み中...</p>
        </div>
      )}

      {isAuthNotImplemented && !isLoading && (
        <div
          style={{
            padding: '2rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '4px',
            color: '#856404',
            textAlign: 'center',
          }}
        >
          <p style={{ margin: 0 }}>
            ※ 現在、認証機能は未実装です。バックエンドAPI実装後にレシピ一覧が表示されます。
          </p>
        </div>
      )}

      {error && (
        <div
          style={{
            padding: '1rem',
            backgroundColor: '#f8d7da',
            border: '1px solid #f5c6cb',
            borderRadius: '4px',
            color: '#721c24',
          }}
        >
          <p style={{ margin: 0 }}>
            レシピの読み込みに失敗しました。
            {error instanceof Error && ` (${error.message})`}
          </p>
        </div>
      )}

      {recipes && <RecipeList recipes={recipes} onRecipeClick={handleRecipeClick} />}
    </div>
  );
}
