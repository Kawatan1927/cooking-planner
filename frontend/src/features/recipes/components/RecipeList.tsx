/**
 * レシピ一覧表示コンポーネント
 */

import type { Recipe } from '../types';

interface RecipeListProps {
  recipes: Recipe[];
  onRecipeClick?: (recipeId: string) => void;
}

/**
 * レシピ一覧をテーブル形式で表示するコンポーネント
 */
export function RecipeList({ recipes, onRecipeClick }: RecipeListProps) {
  if (recipes.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: '#666' }}>
        <p>登録されているレシピがありません。</p>
        <p>「新規レシピを追加」ボタンから登録してください。</p>
      </div>
    );
  }

  return (
    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
      <thead>
        <tr style={{ borderBottom: '2px solid #ddd', textAlign: 'left' }}>
          <th style={{ padding: '0.75rem' }}>レシピ名</th>
          <th style={{ padding: '0.75rem' }}>出典</th>
          <th style={{ padding: '0.75rem' }}>基本人数</th>
          <th style={{ padding: '0.75rem' }}>操作</th>
        </tr>
      </thead>
      <tbody>
        {recipes.map((recipe) => (
          <tr
            key={recipe.recipeId}
            style={{ borderBottom: '1px solid #eee' }}
          >
            <td style={{ padding: '0.75rem' }}>{recipe.name}</td>
            <td style={{ padding: '0.75rem', color: '#666' }}>
              {recipe.sourceBook ? (
                <>
                  {recipe.sourceBook}
                  {recipe.sourcePage && ` (p.${recipe.sourcePage})`}
                </>
              ) : (
                <span style={{ color: '#999' }}>—</span>
              )}
            </td>
            <td style={{ padding: '0.75rem' }}>{recipe.baseServings}人分</td>
            <td style={{ padding: '0.75rem' }}>
              <button
                onClick={() => onRecipeClick?.(recipe.recipeId)}
                style={{
                  padding: '0.25rem 0.75rem',
                  cursor: 'pointer',
                  border: '1px solid #007bff',
                  borderRadius: '4px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  fontSize: '0.875rem',
                }}
              >
                詳細を見る
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
