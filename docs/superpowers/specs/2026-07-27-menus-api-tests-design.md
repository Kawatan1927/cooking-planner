# Menus API単体テスト拡充設計

## 目的

Menus APIの期間取得・登録・更新・削除について、日付と入力の検証、認証済みユーザーの境界、repository連携、エラー応答の既存契約を単体テストで固定し、将来の変更による回帰を防ぐ。

## 対象範囲

- `GET /api/menus`
- `POST /api/menus`
- `PUT /api/menus/:menuId`
- `DELETE /api/menus/:menuId`
- `backend/src/menus/validation.ts` が担う主要な入力検証
- Menus handlerとrepository間の引数変換

実PostgreSQLを使用する統合テスト、APIの期間仕様、`mealType` の定義、献立画面のフロントエンドテストは対象外とする。仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` も変更しない。

## テスト境界

テストはHonoアプリの `app.request` を通して実行する。実際のルーティング、Menus handler、`adapt` によるレスポンス変換を対象に含め、repositoryと認証だけをモジュールmockへ置き換える。

入力検証は公開APIから観測し、`validation.ts` の内部関数を直接テストしない。これにより、HTTP status、エラーbody、不正入力時にrepositoryを呼ばないことを一つのテスト境界で確認する。

既存のAPI動作に仕様との差異が見つかった場合は、テストの期待値を現在の実装へ安易に合わせず、Issue #153と仕様書を基準に原因を確認する。本番コードの変更は、受け入れ条件を満たすために必要な最小限の修正に限定する。

## テスト配置

エンドポイント単位で責務を分け、対象モジュールと同じディレクトリへ配置する。

- `backend/src/menus/getMenus.test.ts`
- `backend/src/menus/createMenu.test.ts`
- `backend/src/menus/updateMenu.test.ts`
- `backend/src/menus/deleteMenu.test.ts`

既存の更新テストは `updateMenu.test.ts` で拡充する。全エンドポイントを一つのファイルへ集約せず、失敗したAPIとmock状態の影響範囲を特定しやすくする。

## GETのテスト設計

`GET /api/menus` は次の契約を検証する。

- システム時刻を固定し、`from` と `to` の未指定時に「今日から7日分」、すなわち今日から6日後までをrepositoryへ渡す
- `from` と `to` の指定時に、その期間をrepositoryへ渡す
- repositoryへ認証済みの `userId` を渡す
- repositoryの献立を公開APIのレスポンス形式へ変換する
- repositoryが空配列を返した場合はstatus 200と空の `items` を返す
- `from` または `to` が不正な日付形式の場合はstatus 400を返し、repositoryを呼ばない
- `from` が `to` より後の場合はstatus 400を返し、repositoryを呼ばない
- repository例外時はstatus 500と既存のエラーbodyを返す

固定時刻はテストごとに設定し、終了時に実時間へ復元する。これにより実行日やタイムゾーンによるテスト結果の変動を防ぐ。

## POSTのテスト設計

正常系ではstatus 201と作成された `menuId` を検証する。repositoryには次の変換済み引数が渡ることを確認する。

- 認証済みの `userId`
- `date`
- 有効な `mealType`
- `recipeId`
- 正の数値の `servings`
- 指定された `memo`、または省略時の `null`

不正入力はテーブル駆動テストで次の分岐を検証する。

- JSONとして解析できないbody
- `date` が空、文字列以外、または有効な `YYYY-MM-DD` 形式でない
- `mealType` が空、文字列以外、または許可値でない
- `recipeId` が空または文字列でない
- `servings` が0以下、数値以外、または有限の正数でない

各ケースでstatus 400、`BAD_REQUEST` のエラーbody、repositoryが呼ばれていないことを確認する。JSONとしては有効でも期待するオブジェクト形状でないbodyが現行実装でstatus 500になる場合は、入力不正として安全にstatus 400へ変換する最小限の本番コード修正を行う。repository例外時はstatus 500と既存のエラーbodyを検証する。

## PUTのテスト設計

既存の正常系、対象なし、UUID不正、入力不正を維持し、次の契約を追加で検証する。

- 正常系ではstatus 200と対象の `menuId` を返す
- repositoryへ認証済みの `userId`、パスの `menuId`、POSTと同じ規則で変換した入力を渡す
- JSONとして解析できないbodyはstatus 400を返し、repositoryを呼ばない
- `validateMenuBody` が拒否する代表的な入力はstatus 400を返し、repositoryを呼ばない
- repositoryが `false` を返す場合は、別ユーザーの献立または対象なしとして `MENU_NOT_FOUND` を返す
- repository例外時はstatus 500と既存のエラーbodyを返す

POSTで入力検証の主要分岐を網羅し、PUTでは同じvalidationを利用することとrepository非呼び出しを代表ケースで確認する。これにより同一規則の過剰な重複を避ける。

## DELETEのテスト設計

`DELETE /api/menus/:menuId` は次の契約を検証する。

- 正常系ではrepositoryへ認証済みの `userId` と `menuId` を渡し、status 204と空bodyを返す
- UUID形式でない `menuId` はstatus 404を返し、repositoryを呼ばない
- repositoryが `false` を返す場合は、別ユーザーの献立または対象なしとして `MENU_NOT_FOUND` を返す
- repository例外時はstatus 500と既存のエラーbodyを返す

データの存在と所有者を外部へ区別して公開せず、更新と削除のどちらもrepositoryのユーザースコープ結果を同じ404へ変換する。

## mockとテスト分離

各テストファイルでは `vi.hoisted` で対象repository関数のmockを定義し、既存テストと同じ認証mockで固定のテストユーザーを返す。`beforeEach` でmockの呼び出し履歴と実装をリセットし、テスト間や並列実行時に状態を共有しない。

repository mockはAPI境界の外側にあるDBアクセスを置き換えるためだけに使用する。mock自身の内部挙動は検証せず、handlerから渡された引数と外部から観測できるHTTPレスポンスを検証する。

対象repository関数はtype-only importと `vi.fn<typeof repositoryFunction>()` で実関数シグネチャへ追従させ、引数・戻り値の契約変更をテストコードの型検査で検出する。

## エラー応答

エラーは仕様書と既存HTTP helperに従い、次の形式を外部から検証する。

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid \"date\" format. Use YYYY-MM-DD",
    "details": null
  }
}
```

入力不正は400、対象なしとUUID不正は404、repository例外は500とする。例外テストでは想定された `console.error` をテスト中だけ抑制し、呼び出しを確認したうえで必ず復元する。

## TDDの進め方

エンドポイントごとに、期待するAPI契約のテストを先に追加して失敗を確認する。その後、テスト追加だけで通る既存契約と、最小限の本番コード修正が必要な仕様差異を切り分ける。

本番コードを修正する場合は、入力を安全に拒否する処理などIssue #153の受け入れ条件に直接必要な範囲に限定する。API期間仕様や `mealType` の定義、repositoryのDB実装は変更しない。

## 検証方法

実装中は追加・変更したテストファイルを個別に実行し、期待するAPI契約を確認する。完了時は次を実行する。

```bash
cd backend
bun run test -- src/menus/getMenus.test.ts src/menus/createMenu.test.ts src/menus/updateMenu.test.ts src/menus/deleteMenu.test.ts
bun run test
cd ..
bun run lint
bun run format:check
bun run type-check
bun run build:all
git diff --check
```

これによりIssue #153の受け入れ条件とリポジトリのPR作成前チェックを満たす。
