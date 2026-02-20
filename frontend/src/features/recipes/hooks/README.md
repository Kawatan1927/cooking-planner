# レシピフック使用ガイド

このディレクトリには、React Query を使用したレシピ機能のカスタムフックが含まれています。

## フック一覧

### `useRecipes`

レシピ一覧を取得するカスタムフックです。

**使用例:**

```tsx
import { useRecipes } from '@features/recipes';

function RecipeListPage() {
  const token = useAuthToken(); // 認証トークンを取得（仮）
  const { data: recipes, isLoading, error, refetch } = useRecipes({ token });

  if (isLoading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error.message}</div>;

  return (
    <div>
      <h1>レシピ一覧</h1>
      <button onClick={() => refetch()}>再読み込み</button>
      <ul>
        {recipes?.map(recipe => (
          <li key={recipe.recipeId}>{recipe.name}</li>
        ))}
      </ul>
    </div>
  );
}
```

**オプション:**

- `token`: 認証トークン（必須）
- `userCacheKey`: クエリキー分離用のユーザー識別子（任意、未指定時は token から自動導出）
- `enabled`: クエリの有効化フラグ（デフォルト: `true`）

### `useRecipe`

特定のレシピの詳細（材料を含む）を取得するカスタムフックです。

**使用例:**

```tsx
import { useRecipe } from '@features/recipes';
import { useParams } from 'react-router-dom';

function RecipeDetailPage() {
  const { recipeId } = useParams<{ recipeId: string }>();
  const token = useAuthToken(); // 認証トークンを取得（仮）
  const {
    data: recipe,
    isLoading,
    error,
  } = useRecipe({
    recipeId: recipeId || '',
    token,
  });

  if (isLoading) return <div>読み込み中...</div>;
  if (error) return <div>エラー: {error.message}</div>;
  if (!recipe) return <div>レシピが見つかりません</div>;

  return (
    <div>
      <h1>{recipe.name}</h1>
      <p>基本人数: {recipe.baseServings}人分</p>
      <h2>材料</h2>
      <ul>
        {recipe.ingredients.map((ingredient, index) => (
          <li key={index}>
            {ingredient.ingredientName}: {ingredient.quantity} {ingredient.unit}
          </li>
        ))}
      </ul>
      {recipe.memo && (
        <div>
          <h2>メモ</h2>
          <p>{recipe.memo}</p>
        </div>
      )}
    </div>
  );
}
```

**オプション:**

- `recipeId`: レシピID（必須）
- `token`: 認証トークン（必須）
- `userCacheKey`: クエリキー分離用のユーザー識別子（任意、未指定時は token から自動導出）
- `enabled`: クエリの有効化フラグ（デフォルト: `true`）

## React Query の機能

これらのフックは `@tanstack/react-query` の `useQuery` をベースにしているため、以下の機能が利用できます：

- **自動キャッシング**: 一度取得したデータはキャッシュされます
- **バックグラウンド更新**: ウィンドウフォーカス時などに自動的に再取得（設定により無効化可能）
- **リトライ**: 失敗時の自動リトライ（デフォルト1回）
- **楽観的更新**: mutation と組み合わせて使用可能

## キャッシュキー

- `useRecipes`: `['recipes', userKey]`
- `useRecipe`: `['recipes', userKey, recipeId]`

これらのキーは、mutation（作成・更新・削除）後のキャッシュ無効化に使用できます。

## エラーハンドリング

フックは `ApiError` クラスのエラーをスローします。エラーには以下の情報が含まれます：

- `statusCode`: HTTPステータスコード
- `code`: エラーコード
- `message`: エラーメッセージ
- `details`: 追加の詳細情報（オプション）

```tsx
import { ApiError } from '@/lib/apiClient';

function RecipeListPage() {
  const { data, error } = useRecipes({ token });

  if (error) {
    if (error instanceof ApiError) {
      console.log('Status:', error.statusCode);
      console.log('Code:', error.code);
      console.log('Message:', error.message);
    }
    return <div>エラーが発生しました</div>;
  }

  // ...
}
```

## 認証について

すべてのAPIエンドポイントは認証が必要です。`token` パラメータには、Cognito から取得した JWT トークンを渡してください。

トークンが `null` または空の場合、クエリは実行されません（`enabled: false` と同じ動作）。

## 型定義

フックで使用される型は `../types.ts` で定義されています：

- `Recipe`: レシピ一覧の要素
- `RecipeDetail`: レシピ詳細（材料を含む）
- `RecipeIngredient`: レシピの材料

## サンプルコンポーネント

`../components/` ディレクトリに、これらのフックを使用したサンプルコンポーネントがあります：

- `RecipeList`: レシピ一覧を表示
- `RecipeDetail`: レシピ詳細を表示
