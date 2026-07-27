# Shopping List API単体テスト拡充設計

## 目的

Shopping List APIの必須期間、日付検証、材料集計、認証済みユーザー境界、repository例外時の既存契約を単体テストで固定し、将来の変更による回帰を防ぐ。

## 対象範囲

- `GET /api/shopping-list`
- `from` / `to` queryの必須・日付・期間検証
- 献立から生成する買い物リストの材料集計
- Shopping List handlerとrepository間の引数連携
- repository例外時の既存エラー応答

テストは `backend/src/shoppingList/getShoppingList.test.ts` に追加する。本番コード、repository、仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。実PostgreSQLを使用する統合テスト、材料名の表記ゆれ補正、単位変換、買い物リスト仕様の変更も対象外とする。

追加テストによって仕様と本番コードの差異が見つかった場合は、期待値を現在の実装へ安易に合わせず、実装を変更する前にユーザーへ確認する。

## テスト境界

テストはHonoアプリの `app.request` を通して実行する。実際のルーティング、Shopping List handler、`adapt` によるレスポンス変換を対象に含め、次の外部境界だけをmodule mockへ置き換える。

- `listMenusInRange`
- `findRecipeWithIngredients`
- 認証済みユーザーの取得

HTTP status、レスポンスbody、repositoryへ渡す引数、不正入力時にrepositoryを呼ばないことを公開APIから検証する。実装内部の集計用関数は直接テストしない。

## テスト配置と補助関数

既存の `backend/src/shoppingList/getShoppingList.test.ts` だけを変更する。現在のrepository mock、認証mock、`app.request`、献立データ生成関数を再利用する。

テストデータの重複が増える場合は、同じテストファイル内にレシピと材料のデータを生成する小さな補助関数を追加する。Issue #154に不要な共通テスト基盤や本番コードのリファクタリングは行わない。

repository mockはtype-only importと `vi.fn<typeof repositoryFunction>()` を使用し、実関数の引数・戻り値へ型で追従させる。

## 入力検証

次のケースをテーブル駆動テストで検証する。

- `from` が未指定
- `to` が未指定
- `from` が `YYYY-MM-DD` 形式でない
- `to` が `YYYY-MM-DD` 形式でない
- `from` または `to` が実在しない日付
- `from` が `to` より後

各ケースでstatus 400、`BAD_REQUEST` の既存エラーbody、`listMenusInRange` と `findRecipeWithIngredients` が呼ばれないことを確認する。既存の `from > to` テストはテーブルへ統合してもよいが、検証内容は維持する。

## 空結果とユーザー境界

repositoryが献立0件を返した場合は、status 200と次のレスポンスを返すことを検証する。

```json
{
  "from": "2026-05-22",
  "to": "2026-05-24",
  "items": []
}
```

このとき `listMenusInRange` へ認証済みの `userId`、`from`、`to` が渡り、レシピ取得は行われないことを確認する。

献立が存在する正常系では、`findRecipeWithIngredients` へ同じ認証済み `userId` と各 `recipeId` が渡ることを確認する。同じレシピを参照する献立が複数ある場合は、リクエスト内キャッシュによりレシピ取得が一度だけであることも検証する。

## 材料集計

複数献立・複数レシピを含む正常系で、次の契約をまとめて検証する。

- `servings / baseServings` の小数倍率で数値quantityをスケーリングする
- 同じ `ingredientName + unit` の数値quantityを合算する
- ingredientNameが同じでもunitが異なる場合は別項目として返す
- 文字列quantityはスケーリングせず、同一キー内で重複排除する
- 数値quantityと文字列quantityが同一キーに混在する場合は `"<数値> + <文字列>"` 形式で返す
- 複数の文字列quantityは既存規則どおり並べて ` + ` で連結する
- 複数献立が同じレシピを参照しても、各献立のservingsを集計へ反映する

期待結果は配列全体を検証し、材料数、単位分離、安定した並び順も固定する。

## エラー応答

次のrepository例外でstatus 500と既存の `INTERNAL_SERVER_ERROR` bodyを返すことを検証する。

- `listMenusInRange` が例外を送出する
- `findRecipeWithIngredients` が例外を送出する

例外テストでは想定された `console.error` をテスト中だけ抑制し、呼び出しを確認したうえで復元する。

既存の「献立が参照するレシピが見つからない場合は500」も維持する。これはrepository例外と区別し、`null` が返った場合の既存エラー契約を保護する。

## TDDの進め方

受け入れ条件に対応するケース群ごとにテストを先に追加し、対象テストを実行する。追加テストが既存実装ですでに通る場合は、テスト追加前にはその契約が未保護だったことを確認し、テスト自体の有効性をレスポンスとmock引数の具体的な期待値で担保する。

本番コードの変更が必要な失敗を検出した場合は、テストを弱めず、原因と仕様との差異を報告して変更可否を確認する。

## 検証方法

実装中は対象テストを個別に実行する。完了時は次を順番に実行する。

```bash
cd backend
bun run test -- src/shoppingList/getShoppingList.test.ts
bun run test
cd ..
bun run lint
bun run format:check
bun run type-check
bun run build:all
git diff --check
```

これによりIssue #154の受け入れ条件とリポジトリのPR作成前チェックを満たす。
