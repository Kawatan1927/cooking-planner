# バックエンド共通処理単体テスト設計

## 目的

複数のバックエンドAPIが依存する入力検証、HTTPレスポンス生成、Hono adapterの既存契約を単体テストで固定し、共通処理の変更による回帰を防ぐ。

## 対象範囲

- `backend/src/shared/validation.ts` のUUID、非空文字列、正数、日付検証
- `backend/src/shared/http.ts` の成功、no content、bad request、not found、internal server error生成
- `backend/src/shared/adapt.ts` の `resultToResponse` と `adapt`
- `backend/src/app.ts` に設定されたHonoのグローバル例外処理

API仕様、プロダクションコードの責務、PostgreSQLとの統合、Cloudflare公開鍵エンドポイントとの通信は変更・検証対象外とする。仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` も変更しない。

## 責務境界

`adapt` はhandlerが返した `HandlerResult` をHonoの `Response` に変換する責務だけを持つ。handlerが送出した例外は捕捉せず、Honoが `backend/src/app.ts` の `app.onError` に引き渡す。例外時の500レスポンスは、この既存の責務分担を維持したままHono統合テストで検証する。

テスト追加を理由に `adapt` へ例外捕捉を追加しない。これにより本番の例外処理、ログ出力、APIレスポンスの挙動を変更しない。

## テスト配置

対象モジュールと同じディレクトリにテストを配置する。

- `backend/src/shared/validation.test.ts`
- `backend/src/shared/http.test.ts`
- `backend/src/shared/adapt.test.ts`
- `backend/src/app-error.test.ts` に例外処理専用のHono統合テストを追加

共通処理の単体テストとHono統合テストを分離し、失敗した責務を特定しやすくする。

## validationのテスト設計

公開関数ごとに正常値、境界値、不正値をテーブル駆動で検証する。

- `isUuid`: 小文字・大文字を含む正しいUUIDと、桁数、区切り、許可文字が不正な値
- `isNonEmptyString`: 通常文字列、前後に空白を含む文字列、空文字、空白のみ、非文字列
- `isPositiveNumber`: 正の整数・小数・最小の正数と、0、負数、`NaN`、正負の無限大、非数値
- `isValidDate`: 通常日、月末、うるう年の2月29日と、平年の2月29日、存在しない月日、ゼロ月日、形式不正

日付は `YYYY-MM-DD` の形式だけでなく、実在する暦日であることを固定する。

## HTTP helperのテスト設計

helperの戻り値を直接比較し、`HandlerResult` の契約を検証する。

- `jsonResponse` が指定したstatusとbodyを保持する
- `noContent` がstatus 204だけを返し、bodyを持たない
- `badRequest`、`notFound`、`internalServerError` がそれぞれ400、404、500を返す
- エラーbodyが `{ error: { code, message, details } }` 形式になる
- details未指定時は `null`、指定時はその値を保持する

## adapterと例外処理のテスト設計

`resultToResponse` は生成されたWeb標準 `Response` を外部から観測して検証する。

- statusが `HandlerResult` から引き継がれる
- bodyがある場合はJSON文字列になり、`Content-Type` がJSON用の値になる
- 204ではbodyが空で、不要なJSON用headerが付かない

`adapt` は同期handlerと非同期handlerの両方について、結果を `Response` へ変換することを確認する。例外を500へ変換する責務は `adapt` に持たせない。

handler例外の既存挙動は `app-error.test.ts` でHonoのリクエスト経路を通して検証する。health routeをテスト内で例外を送出するrouteへモックし、実際の `app.onError` によりstatus 500、JSONのContent-Type、既定のエラーbodyへ変換され、`console.error` が出力されることを外部から観測する。route mockは例外を発生させるためだけに使い、mock自体の呼び出しは検証しない。通常のhealth routeを使う既存 `app.test.ts` とモジュールmockを分離するため、専用ファイルに配置する。`console.error` はテスト中だけモックし、呼び出しを確認したうえで必ず復元する。

## テスト分離と既存テストへの影響

各テストは実PostgreSQLや外部通信を使用せず、モジュールの公開契約だけを検証する。共有mockや環境変数を変更した場合はテストごとに復元し、既存のauth・quantityテストを含む並列実行へ影響させない。

## 検証方法

実装中は追加対象のテストをファイル単位で実行し、期待どおり失敗することを確認してから必要最小限の変更を行う。完了時は以下を実行する。

```bash
cd backend && bun run test
cd .. && bun run lint && bun run format:check && bun run type-check && bun run build:all
cd docs && bun install --frozen-lockfile && bun run format:check && bun run build
```

これによりIssue #151の受け入れ条件と、リポジトリのPR作成前チェックを満たす。
