# backend AGENTS.md

このディレクトリは Bun + Hono の API サーバーです（旧 `infra/lambda/` から移行）。

## 参照する docs

- データモデルは `docs/docs/architecture/data-model.md`
- API の入出力は `docs/docs/features/api-design.md`
- 環境変数や構成変更は必要に応じて `docs/docs/development/environment-variables.mdx` と `docs/docs/architecture/backend.md`

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
  - `authMiddleware()` が Cloudflare Access JWT を検証し、JWT の `email`（なければ `sub`）を userId として Hono context に設定します。
  - ローカル開発では `DEV_USER_ID` を userId として使えます。
- DB アクセスは Drizzle ORM（`drizzle-orm/postgres-js`）で行い、ドメインごとの `repository.ts`（`recipes/` `menus/`）に集約してください。ハンドラーから直接 SQL/クライアントを呼ばないでください。
- スキーマ定義は `src/shared/schema.ts`、接続は `src/shared/db.ts`（`DATABASE_URL`）です。
- `recipes` / `menus` のクエリは必ず `user_id` でスコープしてください。`recipe_ingredients` は `recipe_id` 経由でユーザーコンテキストを継承します（独自の userId カラムは持ちません）。
- API 上の `recipeId` / `menuId` は DB の `id` 列、`quantity` は `quantity_value` / `quantity_text` に対応します。変換はリポジトリ層に閉じてください。
- レスポンス・エラーは `shared/http.ts` のヘルパー（`jsonResponse` / `badRequest` / `notFound` ほか）を使い、
  `docs/docs/features/api-design.md` の形式（エラーは `{ error: { code, message, details } }`）に合わせてください。
- CORS はローカルフロント（`http://localhost:5173`）を許可します（`src/app.ts`）。
- サーバーは **127.0.0.1（ループバック）にのみバインド**してください（`docs/docs/architecture/backend.md`）。
  `0.0.0.0` でバインドしないこと。
- 既存 API のエンドポイント・レスポンス形式（`docs/docs/features/api-design.md`）を変えないでください。
- AWS SDK（`@aws-sdk/*`）を新たに追加しないでください。
- スキーマ変更時は `bun run db:generate` でマイグレーションを生成し、`docs/docs/architecture/data-model.md` も更新してください。

## よく使うコマンド

リポジトリルートから:

- `bun run backend:dev`
- `bun run backend:start`
- `bun run backend:type-check`
- `bun run backend:test`

`backend/` 直下から:

- `bun run dev` / `bun run start` / `bun run type-check` / `bun run lint` / `bun run test`
- `bun run db:generate` / `bun run db:migrate`
