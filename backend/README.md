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
│   ├── recipes/  menus/  shoppingList/   # ドメインのビジネスロジック（ハンドラー）
│   └── shared/               # 共通レイヤー
│       ├── auth.ts           # getUserId(c)（認証移行までの暫定スタブ）
│       ├── http.ts           # HandlerResult とレスポンスヘルパー
│       ├── adapt.ts          # HandlerResult → Hono Response 変換
│       ├── types.ts          # エンティティ型定義
│       ├── dynamodb.ts       # DynamoDB クライアント設定
│       └── validation.ts     # 入力バリデーション
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
- **DynamoDB アクセス**: `@aws-sdk/lib-dynamodb` を使用（DB 層の移行は別 Issue）。
- **認証**: 認証ロジックの移行は別 Issue。現状 `getUserId(c)` は環境変数ベースの暫定スタブです。

## 環境変数

- `PORT` - リッスンポート（デフォルト `3000`）
- `FRONTEND_ORIGIN` - CORS で許可するフロントのオリジン（デフォルト `http://localhost:5173`）
- `DEV_USER_ID` - 暫定 userId スタブが返す値（デフォルト `local-dev-user`、認証移行で廃止予定）
- `RECIPES_TABLE_NAME` / `RECIPE_INGREDIENTS_TABLE_NAME` / `MENUS_TABLE_NAME` - DynamoDB テーブル名
