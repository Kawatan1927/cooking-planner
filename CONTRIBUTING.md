# 開発ガイド

このドキュメントでは、Cooking Planner プロジェクトの開発に貢献する際のガイドラインと手順を説明します。

## 開発環境のセットアップ

### 前提条件

- Node.js 20.x以上
- npm
- Git

### 初回セットアップ手順

1. リポジトリをクローン

```bash
git clone https://github.com/Kawatan1927/cooking-planner.git
cd cooking-planner
```

2. 依存関係をインストール

```bash
# ルートの依存関係（lefthook含む）
npm install

# フロントエンドの依存関係
cd frontend && npm install && cd ..

# Lambdaの依存関係
cd infra/lambda && npm install && cd ../..
```

3. Gitフックの自動セットアップ

`npm install` を実行すると、`prepare` スクリプトによって自動的にlefthookフックがインストールされます。
手動でインストールする場合は：

```bash
npm run prepare
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

#### Lambda

- **TypeScript**: 厳格モードを有効化
- 将来的にlint/formatツールを追加予定

### Gitフックによる自動チェック

このプロジェクトでは [lefthook](https://github.com/evilmartians/lefthook) を使用して、コミット前・プッシュ前に自動でチェックを実行します。

#### pre-commit フック（コミット前）

コミットに含める `frontend/` 配下の staged ファイルに対して以下のチェックを並列実行します：

1. **フォーマットチェック** (`frontend-format`)
   - 対象: `frontend/**/*.{ts,tsx,js,jsx,json,css,md,html}`
   - コマンド: `prettier --check {staged_files}`
   - 失敗時: コミットがブロックされます

2. **Lint** (`frontend-lint`)
   - 対象: `frontend/**/*.{ts,tsx,js,jsx}`
   - コマンド: `eslint {staged_files}`
   - 失敗時: コミットがブロックされます

**目的**: 軽量なチェックで即座にフィードバックを得る

#### pre-push フック（プッシュ前）

リモートにプッシュする前に、push 対象に `frontend/**` または `infra/lambda/**` の変更が含まれる場合だけ、以下のチェックを順次実行します：

1. **フロントエンドのビルド** (`frontend-build`)
   - Viteビルド
   - 内部で `tsc -b` による型チェックを実行
   - 対象: `frontend/**`
   - 所要時間: 約3秒

2. **Lambdaのビルド** (`lambda-build`)
   - TypeScriptコンパイル
   - コンパイル時に型エラーも検出
   - 対象: `infra/lambda/**`
   - 所要時間: 約1秒

3. **テスト** (`tests`)
   - 現在はプレースホルダー（将来的にテストを追加予定）

**目的**: 関連する変更に対して、CIで実行されるチェックをローカルで事前検証

### フックをスキップする場合

緊急時や特別な理由がある場合は、以下のコマンドでフックをスキップできます：

```bash
# pre-commitフックをスキップしてコミット
git commit --no-verify -m "コミットメッセージ"

# pre-pushフックをスキップしてプッシュ
git push --no-verify
```

**⚠️ 注意**: フックをスキップした場合でも、`frontend/**` や `infra/lambda/**` の変更を含む push では GitHub Actions の CI が実行されます。
CIで失敗する可能性が高いため、フックのスキップは極力避けてください。

### 開発コマンド

#### リポジトリ全体

```bash
# すべてのlint実行
npm run lint

# すべてのフォーマットチェック
npm run format:check

# TypeScript型チェック
npm run type-check

# フロントエンドとLambdaのビルド
npm run build:all

# テスト実行（将来的に実装予定）
npm run test
```

#### フロントエンド

```bash
# 開発サーバー起動（ホットリロード）
npm run frontend:dev

# プロダクションビルド
npm run frontend:build

# プレビューサーバー（ビルド後の確認用）
npm run frontend:preview

# Lint実行
npm run frontend:lint

# フォーマット適用
npm run frontend:format

# フォーマットチェックのみ
npm run frontend:format:check
```

#### Lambda

```bash
# ビルド
npm run lambda:build

# ウォッチモード（ファイル変更を監視して自動ビルド）
npm run lambda:watch

# クリーン（distディレクトリを削除）
npm run lambda:clean

# リビルド（クリーン + ビルド）
npm run lambda:rebuild
```

## CI/CD

GitHub Actionsを使用してCI/CDを実行しています。

### ワークフロー

1. **Frontend CI** (`.github/workflows/frontend-ci.yml`)
   - トリガー: `frontend/**` の変更がプッシュまたはPR
   - チェック項目:
     - TypeScript型チェック
     - ESLint
     - Prettier
     - Viteビルド

2. **Lambda CI** (`.github/workflows/lambda-ci.yml`)
   - トリガー: `infra/lambda/**` の変更がプッシュまたはPR
   - チェック項目:
     - TypeScript型チェック
     - ビルド

### ローカルフックとCIの一貫性

lefthookの設定は、CIで実行されるチェックと可能な限り一致するように設計されています。
これにより、関連ファイルの変更でローカルフックをパスすればCIでも成功する可能性が高くなります。

## トラブルシューティング

### フックが実行されない

```bash
# フックが正しくインストールされているか確認
ls -la .git/hooks/ | grep -E "(pre-commit|pre-push)"

# フックを再インストール
npm run prepare

# lefthookの設定を確認
npx lefthook dump
```

### フォーマットエラーが出る場合

```bash
# 自動修正を適用
npm run frontend:format

# 特定のファイルのみ修正
cd frontend
npx prettier --write "path/to/file.tsx"
```

### Lintエラーが出る場合

```bash
# Lint実行
npm run frontend:lint

# 自動修正可能なものを修正
cd frontend
npx eslint . --fix
```

### ビルドエラーが出る場合

```bash
# 依存関係を再インストール
cd frontend
rm -rf node_modules package-lock.json
npm install
cd ..

cd infra/lambda
rm -rf node_modules package-lock.json
npm install
cd ../..
```

## 貢献のガイドライン

### ブランチ戦略

- `main`: プロダクション用ブランチ
- `develop`: 開発用ブランチ
- フィーチャーブランチ: `feature/xxx` または `claude/xxx`

### プルリクエスト

1. 適切なブランチから新しいブランチを作成
2. コードを変更
3. ローカルでテスト（フックが自動実行されます）
4. コミット＆プッシュ（フックが自動実行されます）
5. PRを作成
6. CIのチェックが完了するのを待つ
7. レビューを受けてマージ

### コミットメッセージ

- 日本語または英語で記述
- 変更の内容を簡潔に説明
- 必要に応じてissue番号を参照

例：

```
レシピ一覧ページのレイアウトを修正

- グリッドレイアウトを2カラムから3カラムに変更
- レスポンシブ対応を追加

Refs: #123
```

## ドキュメント

詳細な仕様とアーキテクチャについては、`docs/` ディレクトリを参照してください：

- `docs/01-vision-and-scope.md` - ビジョンとスコープ
- `docs/02-features-and-screens.md` - 機能と画面
- `docs/03-domain-and-data-model.md` - ドメインモデルとデータモデル
- `docs/04-api-design.md` - API設計
- `docs/05-architecture-notes.md` - アーキテクチャノート

## 質問やサポート

質問や問題がある場合は、GitHubのIssueを作成してください。
