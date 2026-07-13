# レシピ機能フロントエンド単体テスト設計

## 目的

レシピの一覧・詳細・登録・更新に関するフロントエンドのデータ取得、キャッシュ制御、主要ユーザー操作を単体テストで保護し、Issue #148の受け入れ条件を満たす。

## 対象範囲

- `frontend/src/features/recipes/api/recipes.ts` の一覧取得、詳細取得、登録、更新
- `frontend/src/features/recipes/hooks/` の一覧・詳細queryと登録・更新mutation
- `RecipeList` と `RecipeDetail`
- `RecipeListPage`、`RecipeNewPage`、`RecipeDetailPage`

仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` に定義されたレシピ一覧・詳細・登録・更新と、Recipes APIのGET、POST、PUT契約に従う。仕様変更は行わず、これらの仕様書も変更しない。

プロダクションコードは原則変更しない。テスト容易性またはアクセシビリティのために不可欠な場合のみ、既存の振る舞いを変えない最小限の修正を行う。

## 対象外

- CSSとレイアウトの検証
- スナップショットテスト
- 実ネットワークやバックエンドを起動する結合テスト
- `RecipeDetailPage` の献立追加モーダルの詳細動作
- 非公開関数やReact内部stateなどの実装詳細

献立追加モーダルの詳細動作は献立機能の責務として、Issue #149側で扱う。

## テスト構成

対象モジュールと同じディレクトリに `*.test.ts` または `*.test.tsx` を配置し、責務ごとに検証する。

- `api/recipes.test.ts`: HTTP method、path、request body、戻り値
- `hooks/useRecipes.test.tsx`: 一覧queryの実行条件とユーザー別cache
- `hooks/useRecipe.test.tsx`: 詳細queryの実行条件とユーザー・レシピ別cache
- `hooks/useCreateRecipe.test.tsx`: 登録mutationと一覧cacheのinvalidate
- `hooks/useUpdateRecipe.test.tsx`: 更新mutationと一覧・詳細cacheのinvalidate
- `components/RecipeList.test.tsx`: 空表示、一覧表示、詳細選択
- `components/RecipeDetail.test.tsx`: loading、error、未取得、材料なし、正常表示
- `pages/RecipeListPage.test.tsx`: 一覧の主要状態と画面遷移
- `pages/RecipeNewPage.test.tsx`: 入力、材料行、validation、登録、成功・失敗
- `pages/RecipeDetailPage.test.tsx`: 初期値反映、編集、保存、成功・失敗

共通helperは、複数のhookテストで明確に重複するQueryClient wrapperなどに限定する。Issue #148だけでしか使わない操作やassertionを過度に抽象化しない。

## API関数のテスト設計

`apiFetch` をVitestでモックし、実ネットワークを使用せずにRecipes API関数が共通APIクライアントへ渡す契約を検証する。

1. 一覧取得は `GET /recipes` を呼び出す。
2. 詳細取得は `GET /recipes/{recipeId}` を呼び出す。
3. 登録は `POST /recipes` と入力したrequest bodyを渡す。
4. 更新は `PUT /recipes/{recipeId}` と入力したrequest bodyを渡す。
5. 共通APIクライアントから返された値を呼び出し側へ返す。

## React Query hookのテスト設計

API関数のみをモックし、各テストで新しい `QueryClient` と `QueryClientProvider` を使用して、実際のReact Queryを通した状態変化を確認する。retryを無効化し、テスト間でcacheを共有しない。

- `useRecipes` は有効時に一覧を取得し、`enabled: false` ではAPIを呼ばない。
- `useRecipe` は有効かつ空でないrecipeIdのときだけ詳細を取得する。
- 一覧・詳細queryは `userCacheKey` ごとにcacheを分離し、詳細はrecipeIdでも分離する。
- `useCreateRecipe` は入力を登録APIへ渡し、成功時に対象ユーザーの一覧cacheをinvalidateする。
- `useUpdateRecipe` はrecipeIdと入力を更新APIへ渡し、成功時に対象ユーザーの一覧cacheと対象レシピの詳細cacheをinvalidateする。
- mutation失敗時には成功時のinvalidateを実行しない。

## コンポーネントとページのテスト設計

React Testing Libraryと `user-event` を使用し、ユーザーから観測できる文言、label、button、heading、table、dialogなどのアクセシブルな要素取得を優先する。

### 一覧

- loading、API error、empty、successを個別に再現する。
- レシピ名、出典、基本人数が表示されることを確認する。
- 「詳細を見る」から対象レシピの詳細へ遷移する。
- 「新規レシピを追加」から登録画面へ遷移する。

### 詳細表示

- loading、error、データ未取得を個別に表示する。
- レシピ基本情報、材料、任意項目を表示する。
- 材料がない場合のempty表示を確認する。

### 登録

- レシピ名、基本人数、材料名、分量、単位の必須validationを確認する。
- 材料行を追加・削除し、最後の1行は削除できないことを確認する。
- 入力値をtrimし、空の任意項目を `null`、数値分量をnumberへ正規化したrequestを登録mutationへ渡す。
- 成功時は返却されたrecipeIdの詳細画面へ遷移する。
- API失敗時はエラーを表示し、詳細画面へ遷移しない。

### 詳細編集

- 取得したレシピをフォームの初期値へ反映する。
- 基本情報と材料の入力変更、材料行の追加・削除を確認する。
- validation済みのrequestを対象recipeIdの更新mutationへ渡す。
- 成功時は保存完了を表示し、失敗時はエラーを表示する。

## 非同期処理とエラー処理

非同期結果には `findBy*` と `waitFor` を使用し、固定時間の待機は行わない。APIやhookの失敗は利用者に表示されるメッセージと、誤ったmutation後処理や画面遷移が発生しないことの両方を確認する。

QueryClientはテストごとに破棄し、Vitestのmockも各テスト後に復元または初期化する。これにより、実行順序や他テストのcacheに依存しないテストとする。

## 検証方法

実装はテスト駆動で進め、追加するテストが対象の振る舞いを正しく検出することを確認する。本体コードを変更する場合は、先に失敗するテストを追加し、必要最小限の修正だけを行う。

完了時は以下を実行する。

```bash
cd frontend && bun run test
cd .. && bun run lint && bun run format:check && bun run type-check && bun run build:all
git diff --check
```

これによりIssue #148の受け入れ条件と、リポジトリのPR作成前チェックを満たす。
