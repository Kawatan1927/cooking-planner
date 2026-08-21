# AGENTS.md

このリポジトリでは、共通ルールはこのファイル、領域固有のルールは `frontend/AGENTS.md` と `backend/AGENTS.md` に記載します。

## プロジェクト概要

- 個人用の料理レシピ／献立／買い物リスト管理アプリです。
- 仕様のソースオブトゥルースは `docs/` 配下の Markdown です。
- フロントエンドは Vite + React + TypeScript です。
- バックエンドは Bun + Hono です。
- データストアは PostgreSQL です。
- 認証境界は Tailscale tailnet を第一候補とし、当面は `DEV_USER_ID` による単一ユーザー運用を許容します。
- 公開は Tailscale Serve 経由の tailnet 内限定公開を第一候補とします。

## 作業前の確認

- `docs/` とコードが矛盾する場合は、原則として `docs/` を優先してください。
- 仕様変更を伴う場合は、関連する `docs/*.md` の更新要否も確認してください。

## 出力ルール

- Issue、PR、レビューコメント、コミットメッセージ、要約は日本語で書いてください。

## Git / PR ワークフロー

- ユーザーからの指示に対応する Issue がまだなければ、作業前に Issue を作成してください。
- Issue タイトルは日本語で簡潔に書き、Conventional Commits の prefix は付けません。
- `enhancement`、`bug`、`documentation` など適切なラベルを付けてください。
- 実装後に PR を作成してください。
- PR タイトルは対応する Issue と同じにしてください。
- PR 作成時は `--label` で適切なラベルを付けてください。
- PR 本文は `.github/PULL_REQUEST_TEMPLATE.md` に従って記載し、「背景 / 関連」セクションの `関連Issue/タスク` 欄を `closes #N` の形式で記載してください。

## コミットメッセージ規則

形式: `<type>: <日本語で変更内容を1行に>`

| type       | 用途                           |
| ---------- | ------------------------------ |
| `feat`     | 新機能の追加                   |
| `fix`      | バグ修正                       |
| `docs`     | ドキュメントのみの変更         |
| `chore`    | 設定・依存・CI など雑務        |
| `refactor` | 動作を変えないリファクタリング |
| `test`     | テストの追加・修正             |
| `style`    | フォーマットのみの変更         |

- 1行目は50文字以内を目安にしてください。
- 例: `feat: ショッピングリストにフィルター機能を追加`

## ブランチ命名規則

ブランチ名は必ず **`<type>/<Issue番号>-<kebab-case-説明>`** 形式に統一します。

| type       | 用途                           |
| ---------- | ------------------------------ |
| `feature`  | 新機能の実装                   |
| `fix`      | バグ修正                       |
| `docs`     | ドキュメントのみの変更         |
| `chore`    | 設定・依存・CI など雑務        |
| `refactor` | 動作を変えないリファクタリング |

**作成コマンド:**

```bash
gh issue develop <Issue番号> --name <type>/<Issue番号>-<kebab-case-説明> --base main --checkout
```

例: `gh issue develop 42 --name feature/42-add-shopping-list-filter --base main --checkout`

**禁止事項:**

- `#` 記号をブランチ名に含めない（`feature/#1` は不可）
- Issue番号を末尾に置かない（`add-foo-7915` は不可）
- SHA やタイムスタンプをサフィックスに付けない

## PR 作成前チェック

PR を作成する前に、変更したディレクトリに応じて以下を実行し、CI と同じ内容をローカルで確認してください。

**① 依存インストール（クリーン環境・初回時）:**

```bash
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

**② すべての変更共通（リポジトリルートから実行）:**

```bash
bun run lint && bun run format:check && bun run type-check && bun run build:all && bun run test
```

**③ `docs/` を変更した場合（追加で実行）:**

```bash
cd docs && bun install --frozen-lockfile && bun run format:check && bun run build
```

## よく使うコマンド

- `bun run dev`
- `bun run start`
- `bun run lint`
- `bun run format:check`
- `bun run type-check`
- `bun run build:all`
- `bun run frontend:test`
- `bun run backend:test`
- `bun run test`

## 領域別ルール

- フロントエンド配下は `frontend/AGENTS.md` を参照してください。
- バックエンド配下は `backend/AGENTS.md` を参照してください。
