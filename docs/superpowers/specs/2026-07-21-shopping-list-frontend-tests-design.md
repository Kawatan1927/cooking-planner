# 買い物リスト機能フロントエンド単体テスト設計

## 目的

期間指定による買い物リスト取得とチェック操作について、API 契約、React Query の取得条件とキャッシュ制御、画面の主要な表示・操作を単体テストで保護し、Issue #150 の受け入れ条件を満たす。

## 対象範囲

- `frontend/src/features/shoppingList/api/shoppingList.ts` の買い物リスト取得
- `frontend/src/features/shoppingList/hooks/useShoppingList.ts` の query 実行条件とキャッシュ分離
- `frontend/src/features/shoppingList/components/ShoppingListItems.tsx` の材料表示とチェック操作
- `frontend/src/features/shoppingList/pages/ShoppingListPage.tsx` の期間指定、表示状態、チェック状態

仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` に定義された買い物リスト画面、ShoppingList ドメイン、Shopping List API 契約に従う。人間のみが編集するこれらの仕様書とプロダクションコードは変更しない。テストによって仕様と現行実装の不一致が判明した場合は、プロダクションコードを修正せず、ユーザーへ報告して対応を相談する。

## 対象外

- チェック状態の永続化
- CSS、見た目、レスポンシブレイアウト
- 実 API、実ネットワーク、実 DB を使用する結合テスト
- React Query、React Router、ブラウザーの内部実装
- 非公開関数や React 内部 state などの実装詳細

## テスト構成

対象モジュールと同じディレクトリに、責務別のテストファイルを配置する。

- `api/shoppingList.test.ts`: query parameter、HTTP method、戻り値
- `hooks/useShoppingList.test.tsx`: query の実行条件、ユーザー・期間別キャッシュ、期間変更時の再取得
- `components/ShoppingListItems.test.tsx`: 材料名、数量、単位、チェック件数、チェック操作
- `pages/ShoppingListPage.test.tsx`: 期間指定、主要表示状態、validation、チェック状態、API エラー

既存の `hooks/queryKeys.test.ts` は Query Key の配列構造を検証しているため、同じ assertion を重複追加しない。hook テストでは `useShoppingList` を実際の `QueryClientProvider` 上で動かし、利用者や期間が異なる query がキャッシュを共有しないことを振る舞いとして検証する。

## API 関数のテスト設計

`apiFetch` を Vitest でモックし、実ネットワークを使用せずに `getShoppingList` が共通 API クライアントへ渡す契約を検証する。

1. `from` と `to` を URL の query parameter に反映する。
2. `GET /shopping-list?from=YYYY-MM-DD&to=YYYY-MM-DD` を呼び出す。
3. HTTP method として `GET` を指定する。
4. 日付値を `URLSearchParams` によってエンコードする。
5. 共通 API クライアントから返された値を呼び出し側へ返す。

## React Query hook のテスト設計

`getShoppingList` のみをモックし、各テストで新しい `QueryClient` と `QueryClientProvider` を使用して、実際の React Query を通した状態変化を確認する。retry を無効化し、テスト間でキャッシュを共有しない。

- `from` と `to` が揃い、`enabled` が有効な場合に指定期間で API を呼び出す。
- `from` または `to` がない場合は API を呼び出さない。
- `enabled: false` の場合は期間が揃っていても API を呼び出さない。
- `userCacheKey` が異なる query はキャッシュを共有しない。
- `from` または `to` が異なる query はキャッシュを共有せず、新しい期間で取得する。

## ShoppingListItems のテスト設計

props だけを使ってコンポーネントを描画し、利用者から観測できる表示と操作を React Testing Library と `user-event` で検証する。

- empty の場合は 0 件中 0 件チェック済みと空のリストを表示する。
- 材料名、数値の数量、文字列の数量を表示する。
- 単位がある数量は数量と単位を連結し、単位がない数量には不要な文字を加えない。
- 初期チェック状態とチェック済み件数を表示する。
- チェックボックス操作時は対象項目のキーだけを `onToggleItem` へ通知する。
- 同じ材料名でも単位が異なる項目を別の項目として扱う。

## ShoppingListPage のテスト設計

`useShoppingList` を Vitest でモックし、Memory Router 上で画面を描画する。API や React Query の内部契約はページテストで再検証せず、hook から与えられた状態に対する表示と利用者操作を検証する。

### 期間指定と取得条件

- URL に有効な `from` と `to` がない場合は query を無効化し、期間指定の案内を表示する。
- URL に有効な期間がある場合は、その期間を hook 引数と入力欄へ反映する。
- 開始日と終了日を変更して送信すると、URL query と hook 引数を更新する。
- 期間変更後は新しい期間の取得結果を表示する。
- 未入力、`YYYY-MM-DD` 形式でない値、終了日が開始日より前の期間はエラーを表示し、検索条件を更新しない。

### 主要表示状態

- loading 中は読み込み中表示と対象期間を表示する。
- API 失敗時は固定のエラー見出しと実際のエラーメッセージを表示する。
- 取得結果が空の場合は対象項目がない旨と対象期間を表示する。
- 取得結果がある場合は対象期間、材料名、数量、単位を表示する。

### チェック操作

- チェックボックス操作は選択した項目だけを checked にする。
- 別の項目の checked 状態には影響を与えない。
- 期間条件を変更して再検索した場合は、以前の期間のチェック状態をリセットする。

## 非同期処理とテスト分離

非同期結果には `findBy*` と `waitFor` を使用し、固定時間の待機は行わない。QueryClient、Vitest の mock、システム日時はテストごとに初期化し、各テスト後に復元する。これにより、実行順序、他テストのキャッシュ、実行日に依存しないテストとする。

API テスト、hook テスト、コンポーネントテスト、ページテストは責務を重複させず、失敗時に原因となる層を特定できるようにする。共通 helper は既存のテストユーティリティに限定し、買い物リスト固有の操作や assertion を過度に抽象化しない。

## 検証方法

各テストファイルを追加した段階で対象テストを実行する。既存のプロダクションコードに対するテスト追加のため、新しいテストが最初から成功する場合は、対象コードを一時的に変更して失敗を捏造せず、期待する契約と assertion が実装から独立していることをレビューする。仕様との不一致によって失敗する場合は、プロダクションコードを変更せずユーザーへ報告する。

すべてのテスト追加後は以下を実行する。

```powershell
cd frontend
bun run test
cd ..
bun run lint
bun run format:check
bun run type-check
bun run build:all
git diff --check
```

検証後、Issue タイトルと同じ「買い物リスト機能のフロントエンド単体テストを追加する」を PR タイトルに使用し、`closes #150` を本文に記載した `enhancement` ラベル付き Draft PR を作成する。
