# 開発ガイド

このドキュメントでは、Cooking Planner プロジェクトの開発に貢献する際のガイドラインと手順を説明します。

## 開発環境のセットアップ

### 前提条件

- Bun 1.x 以上
- Node.js 20.x 以上
- PostgreSQL
- Git

### 初回セットアップ手順

1. リポジトリをクローン

```bash
git clone https://github.com/Kawatan1927/cooking-planner.git
cd cooking-planner
```

2. 依存関係をインストール

```bash
bun install --frozen-lockfile
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
```

3. Git フックをセットアップ

```bash
bun run prepare
```

## 開発ワークフロー

### コーディング規約

#### フロントエンド

- **Formatter**: Prettier
  - 設定: `frontend/.prettierrc`
  - セミコロン: あり
  - シングルクォート: あり
  - タブ幅: 2スペース
  - 行の長さ: 100文字

- **Linter**: ESLint
  - 設定: `frontend/eslint.config.js`
  - ルール: TypeScript ESLint + React Hooks + React Refresh

- **TypeScript**: 厳格モードを有効化

#### バックエンド

- **Formatter**: Prettier
  - 設定: `backend/.prettierrc`
  - セミコロン: あり
  - シングルクォート: あり
  - タブ幅: 2スペース
  - 行の長さ: 100文字

- **Linter**: ESLint
  - 設定: `backend/eslint.config.mjs`
  - ルール: TypeScript ESLint + Prettier 競合ルールの無効化

- **TypeScript**: 厳格モードを有効化

### Git フックによる自動チェック

このプロジェクトでは [lefthook](https://github.com/evilmartians/lefthook) を使用して、コミット前・プッシュ前に自動でチェックを実行します。

#### pre-commit フック（コミット前）

コミットに含める `frontend/` と `backend/` 配下の staged ファイルに対して以下のチェックを並列実行します。

| フック名          | 対象                                      | 内容               |
| ----------------- | ----------------------------------------- | ------------------ |
| `frontend-format` | `frontend/**/*.{ts,tsx,js,jsx,json,css,md,html}` | Prettier チェック |
| `frontend-lint`   | `frontend/**/*.{ts,tsx,js,jsx}`           | ESLint             |
| `backend-format`  | `backend/**/*.{ts,js,json,md}`            | Prettier チェック |
| `backend-lint`    | `backend/**/*.ts`                         | ESLint             |

#### pre-push フック（プッシュ前）

push 対象に `frontend/**` または `backend/**` の変更が含まれる場合だけ、関連するビルド・フォーマットチェック・lint・テストを実行します。

### フックをスキップする場合

```bash
git commit --no-verify -m "コミットメッセージ"
git push --no-verify
```

フックをスキップした場合でも、`frontend/**` や `backend/**` の変更を含む push では GitHub Actions の CI が実行されます。CI で失敗する可能性が高いため、フックのスキップは極力避けてください。

### 開発コマンド

#### リポジトリ全体

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

#### フロントエンド

```bash
bun run frontend:dev
bun run frontend:build
bun run frontend:preview
bun run frontend:lint
bun run frontend:format
bun run frontend:format:check
```

#### バックエンド

```bash
bun run backend:dev
bun run backend:start
bun run backend:lint
bun run backend:format
bun run backend:format:check
bun run backend:type-check
bun run backend:test
```

## CI/CD

GitHub Actions を使用して CI/CD を実行しています。

### ワークフロー

1. **Frontend CI**
   - トリガー: `frontend/**` の変更がプッシュまたは PR
   - チェック項目: TypeScript 型チェック、ESLint、Prettier、Vite ビルド

2. **Backend CI**
   - トリガー: `backend/**` の変更がプッシュまたは PR
   - チェック項目: ESLint、Prettier、TypeScript 型チェック、テスト

3. **Docs CI**
   - トリガー: `docs/**` の変更がプッシュまたは PR
   - チェック項目: Prettier フォーマットチェック、Docusaurus ビルド

### ローカルフックと CI の一貫性

lefthook の設定は、CI で実行されるチェックと可能な限り一致するように設計されています。関連ファイルの変更でローカルフックを通してから push してください。

## トラブルシューティング

### フックが実行されない

```bash
Get-ChildItem .git/hooks | Where-Object { $_.Name -match "pre-commit|pre-push" }
bun run prepare
bunx lefthook dump
```

### フォーマットエラーが出る場合

```bash
bun run frontend:format
bun run backend:format
bun run docs:format
```

### Lint エラーが出る場合

```bash
bun run frontend:lint
bun run backend:lint
```

### ビルドエラーが出る場合

```bash
cd frontend && bun install --frozen-lockfile && cd ..
cd backend && bun install --frozen-lockfile && cd ..
bun run build:all
```

## 貢献のガイドライン

### ブランチ戦略

- `main`: プロダクション用ブランチ
- `develop`: 開発用ブランチ
- 作業ブランチ: `<type>/<Issue番号>-<kebab-case-説明>` 形式
  - 例: `feature/42-add-shopping-list-filter`
  - `type` は `feature` / `fix` / `docs` / `chore` / `refactor` など、変更内容に応じて選択

### プルリクエスト

1. 適切なブランチから新しいブランチを作成
2. コードまたはドキュメントを変更
3. ローカルで検証
4. コミット＆プッシュ
5. PR を作成
6. CI のチェック完了を待つ
7. レビューを受けてマージ

### コミットメッセージ

- 日本語で記述
- 変更の内容を簡潔に説明
- 必要に応じて issue 番号を参照

例:

```text
docs: 開発手順をバックエンド構成に更新

- backend ディレクトリのセットアップ手順を追加
- 古い実行コマンドを現行スクリプトに置換
```

## ドキュメント

詳細な仕様とアーキテクチャについては、`docs/` ディレクトリを参照してください。

- `docs/01-vision-and-scope.md` - ビジョンとスコープ
- `docs/02-features-and-screens.md` - 機能と画面
- `docs/03-domain-and-data-model.md` - ドメインモデルとデータモデル
- `docs/04-api-design.md` - API 設計
- `docs/05-architecture-notes.md` - アーキテクチャノート

## ドキュメント変更ガイドライン

### どの文書をどこに書くか

| 変更内容                         | 追記先ファイル                  |
| -------------------------------- | ------------------------------- |
| アプリのビジョン・スコープ       | `docs/01-vision-and-scope.md`   |
| 機能定義・画面仕様               | `docs/02-features-and-screens.md` |
| ドメインモデル・データモデル     | `docs/03-domain-and-data-model.md` |
| API 設計（エンドポイント・スキーマ） | `docs/04-api-design.md`          |
| アーキテクチャ・インフラ構成     | `docs/05-architecture-notes.md` |
| 開発環境・コーディング規約       | `CONTRIBUTING.md`               |
| Docusaurus サイト向けコンテンツ  | `docs/docs/` 配下の対応ディレクトリ |

Docusaurus サイト（`docs/docs/`）は以下のカテゴリに分かれています。

- `getting-started/` - 開発環境セットアップ手順
- `features/` - 機能・画面仕様・API 設計
- `architecture/` - アーキテクチャ・データモデル・インフラ
- `development/` - コーディング規約・テスト・GitHub ワークフロー

### ドキュメント変更時のレビュー観点

1. **整合性**: 変更内容がコードや他の仕様書と矛盾していないか
2. **記載先**: 変更対象のドキュメントが上記の「どこに書くか」ルールに沿っているか
3. **フォーマット**: Prettier の規則に従っているか
4. **ビルド**: Docusaurus でビルドエラーが発生していないか
5. **Mermaid 図**: 図を追加・変更した場合、レンダリング結果が意図通りか
6. **リンク**: 内部リンクが正しく機能するか

### ドキュメントのローカル確認

```bash
cd docs
bun install --frozen-lockfile
bun run start
bun run format:check
bun run format
bun run build
```

## 質問やサポート

質問や問題がある場合は、GitHub の Issue を作成してください。
