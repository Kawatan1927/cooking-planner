# 献立機能フロントエンド単体テスト設計

## 目的

献立の期間取得・登録・更新・削除に関するAPI契約、React Queryのキャッシュ制御、献立画面の主要ユーザー操作を単体テストで保護し、Issue #149の受け入れ条件を満たす。

## 対象範囲

- `frontend/src/features/menus/api/menus.ts` の期間取得、登録、更新、削除
- `frontend/src/features/menus/hooks/` の一覧queryと登録・更新・削除mutation
- `frontend/src/features/menus/pages/MenusPage.tsx` の表示条件、表示状態、追加・編集・削除操作

仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` に定義された献立画面、献立データ、Menus APIのGET、POST、PUT、DELETE契約に従う。人間のみが編集するこれらの仕様書は変更しない。プロダクションコードの変更は、Issue #149が要求する削除確認UIを追加する最小限の変更に限定する。

## 対象外

- カレンダーライブラリの内部動作
- CSS、見た目、レスポンシブレイアウト
- 実API、実ネットワーク、実DBを使用する結合テスト
- レシピ機能そのものの表示・編集
- 非公開関数やReact内部stateなどの実装詳細

## テスト構成

対象モジュールと同じディレクトリに `*.test.ts` または `*.test.tsx` を配置し、責務ごとに検証する。

- `api/menus.test.ts`: query parameter、HTTP method、path、request body、戻り値
- `hooks/useMenus.test.tsx`: queryの実行条件、期間引数、ユーザー・期間別cache
- `hooks/useCreateMenu.test.tsx`: 登録mutationと一覧cacheのinvalidate
- `hooks/useUpdateMenu.test.tsx`: 更新mutationと一覧cacheのinvalidate
- `hooks/useDeleteMenu.test.tsx`: 削除mutationと一覧cacheのinvalidate
- `pages/MenusPage.test.tsx`: 表示期間、主要表示状態、追加・編集・削除、validation、API失敗

既存の `hooks/queryKeys.test.ts` はユーザー・期間別Query Keyをすでに検証しているため再利用し、同じassertionを重複追加しない。共通helperは既存のQueryClient用テストユーティリティに限定し、献立機能固有の操作やassertionを過度に抽象化しない。

## API関数のテスト設計

`apiFetch` をVitestでモックし、実ネットワークを使用せずにMenus API関数が共通APIクライアントへ渡す契約を検証する。

1. 期間未指定の一覧取得は `GET /menus` を呼び出す。
2. `from` または `to` の片方だけを指定した場合は、指定値だけをURLエンコードしてquery parameterへ含める。
3. `from` と `to` の両方を指定した場合は、両方をquery parameterへ含める。
4. 登録は `POST /menus` と入力したrequest bodyを渡す。
5. 更新は `PUT /menus/{menuId}` と入力したrequest bodyを渡す。
6. 削除は `DELETE /menus/{menuId}` を呼び出す。
7. 共通APIクライアントから返された値を呼び出し側へ返す。

## React Query hookのテスト設計

API関数のみをモックし、各テストで新しい `QueryClient` と `QueryClientProvider` を使用して、実際のReact Queryを通した状態変化を確認する。retryを無効化し、テスト間でcacheを共有しない。

- `useMenus` は有効時に正規化した期間を一覧APIへ渡し、`enabled: false` ではAPIを呼ばない。
- 空文字の期間は未指定として扱う。
- 一覧queryは `userCacheKey` と期間ごとにcacheを分離する。
- `useCreateMenu` は入力を登録APIへ渡し、成功時に対象ユーザーの献立cacheをinvalidateする。
- `useUpdateMenu` はmenuIdと入力を更新APIへ渡し、成功時に対象ユーザーの献立cacheをinvalidateする。
- `useDeleteMenu` はmenuIdを削除APIへ渡し、成功時に対象ユーザーの献立cacheをinvalidateする。
- 各mutationの失敗時はエラーを呼び出し側へ返し、成功時のinvalidateを実行しない。

## MenusPageのテスト設計

各hookをVitestでモックし、React Testing Libraryと `user-event` を使用して、利用者から観測できる文言、label、button、heading、listなどのアクセシブルな要素取得を優先する。

### 表示条件と主要状態

- 初期表示では開始日から7日間を取得し、開始日または表示日数の変更をquery引数と取得期間表示へ反映する。
- 表示日数は1日から30日の範囲へ正規化する。
- loading、取得エラー、emptyを個別に表示する。
- 取得した献立を日付と朝食・昼食・夕食の区分ごとに表示する。
- レシピ一覧に存在するrecipeIdはレシピ名を表示し、存在しないrecipeIdは代替表示にする。

### 追加

- 日付、食事区分、recipeId、servingsを入力し、正規化したrequestを登録mutationへ渡す。
- recipeIdが空の場合とservingsが正の有限数でない場合はエラーを表示し、登録mutationを呼ばない。
- 登録成功時はエラーを消去し、recipeIdとservingsを初期値へ戻す。
- 登録失敗時はAPIエラーを表示し、入力したrecipeIdとservingsを保持する。

### 編集

- 登録済み献立のrecipeIdとservingsを編集し、対象menuIdの更新mutationへ渡す。
- recipeIdが空の場合とservingsが正の有限数でない場合はエラーを表示し、更新mutationを呼ばない。
- 更新失敗時はAPIエラーを表示し、編集中のrecipeIdとservingsを保持する。

### 削除

- 削除ボタン押下時に、対象の献立を削除するか確認する `window.confirm` を表示する。
- 確認をキャンセルした場合は削除mutationを呼ばない。
- 確認を承認した場合は対象menuIdを削除mutationへ渡す。
- 削除失敗時はAPIエラーを表示し、対象の献立を画面から不適切に失わない。

## 非同期処理とテスト分離

非同期結果には `findBy*` と `waitFor` を使用し、固定時間の待機は行わない。QueryClientはテストごとに生成し、Vitestのmock、`window.confirm`、システム日時は各テストで復元または初期化する。これにより、実行順序、他テストのcache、実行日に依存しないテストとする。

画面テストはAPIやReact Queryの内部状態を再検証せず、hookから与えられた状態に対する表示と操作だけを検証する。APIテスト、hookテスト、画面テストの失敗原因を分離する。

## 検証方法

テストファイル単位で対象テストを実行する。削除確認UIは、先に確認なしで削除mutationが呼ばれることを示す失敗テストを追加し、その後に最小限の実装を行って成功を確認する。それ以外の失敗内容が仕様と現行実装の不一致を示す場合は、追加のプロダクションコードを変更せず報告する。すべてのテスト追加後は以下を実行する。

```bash
cd frontend && bun run test
cd .. && bun run lint && bun run format:check && bun run type-check && bun run build:all
git diff --check
```

検証後、Issueタイトルと同じ「献立機能のフロントエンド単体テストを追加する」をPRタイトルに使用し、`enhancement` ラベル付きDraft PRを作成する。
