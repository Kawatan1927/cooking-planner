# backend AGENTS.md

このディレクトリは Bun + Hono の API サーバーです（旧 `infra/lambda/` から移行）。

## 参照する docs

- データモデルは `docs/03-domain-and-data-model.md`
- API の入出力は `docs/04-api-design.md`
- 環境変数や構成変更は必要に応じて `docs/05-architecture-notes.md`

## 実装ルール

- ルーティングは Hono の宣言的ルーター（`src/routes/`）で定義してください。パスパラメータは `:param` 記法です。
- ドメインのハンドラーは `(c: Context) => HandlerResult`（`Promise` 可）として実装し、
  `src/routes/` で `adapt(handler)` を介して登録してください（`adapt` が `HandlerResult` を Hono の `Response` に変換します）。
- ハンドラー追加時は既存のドメイン単位の分割（`recipes/` `menus/` `shoppingList/`）に合わせてください。
- リクエストの取得は Hono のコンテキスト経由で行ってください:
  - パスパラメータ: `c.req.param('recipeId')`
  - クエリ: `c.req.query('from')`
  - ボディ: `await c.req.json()`
- `userId` は `shared/auth.ts` の `getUserId(c)` から一貫して取得してください。
  - これは認証移行（別 Issue）までの**暫定スタブ**です。認証方式が決まったらこの 1 関数のみを差し替えます。
- DynamoDB との通信は AWS SDK v3（`@aws-sdk/lib-dynamodb`）を使ってください（DB 層の移行は別 Issue）。
- DynamoDB 操作では `userId` を条件に含めてください。
- レスポンス・エラーは `shared/http.ts` のヘルパー（`jsonResponse` / `badRequest` / `notFound` ほか）を使い、
  `docs/04-api-design.md` の形式（エラーは `{ error: { code, message, details } }`）に合わせてください。
- CORS はローカルフロント（`http://localhost:5173`）を許可します（`src/app.ts`）。
- サーバーは **127.0.0.1（ループバック）にのみバインド**してください（`docs/05-architecture-notes.md` §6.1）。
  `0.0.0.0` でバインドしないこと。
- 既存 API のエンドポイント・レスポンス形式（`docs/04-api-design.md`）を変えないでください。
- Lambda 固有の SDK（`@aws-sdk/client-lambda` 等）を新たに追加しないでください。

## よく使うコマンド

リポジトリルートから:

- `bun run backend:dev`
- `bun run backend:start`
- `bun run backend:type-check`
- `bun run backend:test`

`backend/` 直下から:

- `bun run dev` / `bun run start` / `bun run type-check` / `bun run lint` / `bun run test`
