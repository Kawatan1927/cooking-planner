# フロントエンド共通API・Query Key単体テスト設計

## 目的

フロントエンドの全機能が依存する共通APIクライアントとQuery Key生成規則を単体テストで固定し、通信処理やキャッシュ分離の回帰を防ぐ。

## 対象範囲

- `frontend/src/lib/apiClient.ts` の公開APIである `apiFetch` と `ApiError`
- `frontend/src/lib/queryKeyUtils.ts` の `getUserCacheKey`
- Recipes、Menus、Shopping ListのQuery Key生成関数

個別画面のレンダリング、実APIへの通信、E2Eテストは対象外とする。プロダクションコードは、テストでIssue #147の受け入れ条件に反する挙動が判明した場合に限り修正する。仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。

## テスト配置

対象モジュールと同じディレクトリに `*.test.ts` を配置する。

- `frontend/src/lib/apiClient.test.ts`
- `frontend/src/lib/queryKeyUtils.test.ts`
- `frontend/src/features/recipes/hooks/queryKeys.test.ts`
- `frontend/src/features/menus/hooks/queryKeys.test.ts`
- `frontend/src/features/shoppingList/hooks/queryKeys.test.ts`

対象コードとテストの対応を明確にし、機能の移動・削除時にもテストを追従しやすくする。テストファイルはアプリケーションコードからimportしないため、本番ビルドの依存グラフには含めない。

## APIクライアントのテスト設計

`globalThis.fetch` をVitestでモックし、実ネットワークを使用せずに `apiFetch` の外部から観測できる振る舞いを検証する。各テスト後にモックを復元し、テスト間の状態を分離する。

検証項目は次のとおりとする。

1. `VITE_API_BASE_URL` とパスの末尾・先頭のスラッシュ有無にかかわらず、スラッシュが重複しないURLでfetchされる。
2. bodyが指定された場合、JSON文字列へ変換され、既存headerを保持したうえで `Content-Type: application/json` が設定される。
3. `credentials` 未指定時は `include`、明示時は指定値がfetchへ渡される。
4. JSONの2xxレスポンスはパースされた値を返す。
5. 204または非JSONの成功レスポンスは `null` を返す。
6. API仕様に沿うJSONエラーは、status、code、message、detailsを保持する `ApiError` になる。
7. 非JSONエラーは、レスポンス本文またはstatus textをmessageとする `UNKNOWN_ERROR` の `ApiError` になる。

## Query Keyのテスト設計

生成された配列を直接比較し、キャッシュ境界を仕様として固定する。

- `getUserCacheKey` はユーザーキーを指定した場合にその値を返し、未指定、`null`、空文字の場合は共通の既定キーを返す。
- Recipesはユーザーごとに一覧を分離し、詳細ではさらにレシピIDを含める。
- Menusはユーザーごとの共通prefixを持ち、一覧では開始日・終了日を含める。期間未指定値も一意の規則で表現する。
- Shopping Listはユーザー、開始日、終了日のすべてを含める。

異なるユーザー、ID、検索期間から生成したQuery Keyが等しくないことも確認し、キャッシュ衝突を防ぐ。

## エラー処理

エラーの検証ではメッセージだけでなく `ApiError` の型と `statusCode`、`code`、`details` を確認する。これにより、呼び出し側がエラー種別や詳細を利用する契約を保護する。非JSONかつ本文が空の場合はstatus textへフォールバックする既存契約も検証する。

## 検証方法

実装中は追加したテストを対象ファイル単位で実行し、期待どおり失敗することを確認してから必要最小限の実装を行う。完了時は以下を実行する。

```bash
cd frontend && bun run test
cd .. && bun run lint && bun run format:check && bun run type-check && bun run build:all
```

これによりIssue #147の受け入れ条件と、リポジトリのPR作成前チェックを満たす。
