# Backend (Hono Server)

Cooking Planner の API サーバー。Bun ランタイム上で Hono を使って動作する HTTP サーバーです。

> 旧構成（AWS Lambda + API Gateway）から移行しました（[#127](https://github.com/Kawatan1927/cooking-planner/issues/127)）。
> デプロイ先はローカル PC + Cloudflare Tunnel を前提とします。

## 構成

```
backend/
├── src/
│   ├── index.ts              # Bun エントリーポイント（Bun.serve 設定）
│   ├── app.ts                # Hono app（CORS / ルート登録 / エラーハンドリング）
│   ├── routes/               # ドメインごとの Hono ルーター
│   │   ├── health.ts         # GET /health
│   │   ├── recipes.ts        # /recipes
│   │   ├── menus.ts          # /menus
│   │   └── shoppingList.ts   # /shopping-list
│   ├── recipes/              # レシピドメイン（ハンドラー + repository.ts）
│   ├── menus/                # 献立ドメイン（ハンドラー + repository.ts）
│   ├── shoppingList/         # 買い物リストドメイン（ハンドラー）
│   └── shared/               # 共通レイヤー
│       ├── auth.ts           # getUserId(c)（認証移行までの暫定スタブ）
│       ├── db.ts             # postgres-js + Drizzle ORM 接続設定
│       ├── schema.ts         # Drizzle スキーマ定義（テーブル / 型）
│       ├── http.ts           # HandlerResult とレスポンスヘルパー
│       ├── adapt.ts          # HandlerResult → Hono Response 変換
│       ├── types.ts          # エンティティ型定義
│       └── validation.ts     # 入力バリデーション
├── drizzle/                  # Drizzle が生成したマイグレーションファイル
├── drizzle.config.ts         # Drizzle Kit 設定
├── package.json
└── tsconfig.json
```

## セットアップ・起動

```bash
# 依存パッケージのインストール
bun install

# 開発（Watch モード、127.0.0.1:3000）
bun run dev

# 本番起動
bun run start

# 型チェック / Lint / テスト
bun run type-check
bun run lint
bun run test
```

- ポートは環境変数 `PORT`（デフォルト `3000`）で変更可能。
- サーバーは **127.0.0.1（ループバック）にのみバインド**します（`docs/05-architecture-notes.md` §6.1）。
- 開発フロント（Vite `http://localhost:5173`）からの CORS を許可します。許可オリジンは
  環境変数 `FRONTEND_ORIGIN`（デフォルト `http://localhost:5173`）で変更可能。

## 疎通確認

```bash
curl http://localhost:3000/health
# => {"status":"ok","time":"2026-..."}
```

## 開発方針

- **小さめモノリス構成**: 1 つの Hono app が全パスを処理します。
- **型安全性**: TypeScript の strict モードを有効化。
- **データアクセス**: Drizzle ORM（`drizzle-orm/postgres-js`）を使用。スキーマは `src/shared/schema.ts`、接続設定は `src/shared/db.ts`。各ドメインの `repository.ts` が DB 操作を担います。
- **認証**: 認証ロジックの移行は別 Issue。現状 `getUserId(c)` は環境変数ベースの暫定スタブです。

## マイグレーション

```bash
# マイグレーションファイルの生成（スキーマ変更後）
bun run db:generate

# マイグレーションの適用
bun run db:migrate
```

## 環境変数

- `PORT` - リッスンポート（デフォルト `3000`）
- `FRONTEND_ORIGIN` - CORS で許可するフロントのオリジン（デフォルト `http://localhost:5173`）
- `DEV_USER_ID` - 暫定 userId スタブが返す値（デフォルト `local-dev-user`、認証移行で廃止予定）
- `DATABASE_URL` - PostgreSQL 接続文字列（例: `postgresql://user:pass@localhost:5432/cooking_planner`）
