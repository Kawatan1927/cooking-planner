# Cooking Planner

個人利用の料理レシピ／献立／買い物リスト管理アプリケーションです。フロントエンドは Vite + React、バックエンドは Bun + Hono、データストアは PostgreSQL で構成します。

## プロジェクト構成

```text
cooking-planner/
├── frontend/      # Vite + React フロントエンド
├── backend/       # Bun + Hono API / 静的ファイル配信サーバー
├── docs/          # 仕様書とDocusaurusドキュメント
├── scripts/       # 補助スクリプト
└── .github/       # GitHub Actions / PRテンプレート
```

## セットアップ

### 前提条件

- [Bun](https://bun.sh/) 1.x 以上
- Node.js 20.x 以上
- PostgreSQL
- Cloudflare Tunnel を使う場合は `cloudflared`

### 初回セットアップ

1. リポジトリをクローン

```bash
git clone https://github.com/Kawatan1927/cooking-planner.git
cd cooking-planner
```

2. 依存関係のインストール

```bash
bun install --frozen-lockfile
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

3. Git フックのセットアップ

```bash
bun run prepare
```

## 開発

### 環境変数

ルートまたはバックエンド実行時の `.env` に最低限以下を設定します。

```bash
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
PORT=3000
DEV_USER_ID=local-dev-user
```

Cloudflare Access 経由で動かす場合は、`DEV_USER_ID` の代わりに Cloudflare Access の検証用設定を使用します。詳細は `docs/docs/development/environment-variables.mdx` を参照してください。

### よく使うコマンド

```bash
bun run dev
bun run start
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

### 個別コマンド

```bash
# フロントエンド
bun run frontend:dev
bun run frontend:build
bun run frontend:lint
bun run frontend:format
bun run frontend:format:check

# バックエンド
bun run backend:dev
bun run backend:start
bun run backend:lint
bun run backend:format
bun run backend:format:check
bun run backend:type-check
bun run backend:test

# ドキュメント
bun run docs:dev
bun run docs:build
bun run docs:format
bun run docs:format:check
```

## Git フック

[lefthook](https://github.com/evilmartians/lefthook) を使用してローカルで CI 相当のチェックを自動実行します。

- **pre-commit**: コミットに含める `frontend/` と `backend/` 配下の staged ファイルに対してフォーマットチェックと lint を実行
- **pre-push**: `frontend/**` または `backend/**` の変更があるときだけ、ビルドとテストを実行
- **test**: `bun run backend:test` を実行

フックをスキップする場合:

```bash
git commit --no-verify
git push --no-verify
```

フックをスキップすると CI 失敗のリスクが上がります。詳細は [CONTRIBUTING.md](./CONTRIBUTING.md) を参照してください。

## CI/CD

GitHub Actions では以下を確認します。

- フロントエンドの lint、フォーマットチェック、型チェック、ビルド
- バックエンドの lint、フォーマットチェック、型チェック、テスト
- ドキュメントのフォーマットチェック、Docusaurus ビルド

## 起動と公開

開発時:

1. PostgreSQL を起動する
2. `.env` に `DATABASE_URL`、`PORT`、`DEV_USER_ID` を設定する
3. `bun run dev` で frontend/backend を起動する

本番相当:

1. PostgreSQL を起動する
2. `.env` に `DATABASE_URL` と `PORT` を設定する
3. Cloudflare Access の設定値を `.env` に設定する
4. `bun run start` で frontend build 後に Hono server を起動する
5. Cloudflare Tunnel を Hono server の port に向ける
6. Cloudflare Access で許可ユーザーを制限する

詳細は `docs/docs/deployment/` と `docs/docs/getting-started/` を参照してください。

## ドキュメント

詳細な仕様とアーキテクチャについては、`docs/` ディレクトリを参照してください。

- `docs/01-vision-and-scope.md` - ビジョンとスコープ
- `docs/02-features-and-screens.md` - 機能と画面
- `docs/03-domain-and-data-model.md` - ドメインモデルとデータモデル
- `docs/04-api-design.md` - API設計
- `docs/05-architecture-notes.md` - アーキテクチャノート

Docusaurus サイト向けの文書は `docs/docs/` 配下にあります。

## ライセンス

Private repository
