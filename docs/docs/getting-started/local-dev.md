---
id: local-dev
title: ローカル開発環境のセットアップ
sidebar_position: 1
---

## 前提条件

- [Bun](https://bun.sh/) 1.x 以上
- Node.js 20.x 以上

## 初回セットアップ

### 1. リポジトリをクローン

```bash
git clone https://github.com/Kawatan1927/cooking-planner.git
cd cooking-planner
```

### 2. 依存関係のインストール

```bash
# ルートの依存関係をインストール（lefthook を含む）
bun install --frozen-lockfile

# フロントエンドの依存関係をインストール
cd frontend && bun install --frozen-lockfile && cd ..

# Lambda の依存関係をインストール
cd infra/lambda && bun install --frozen-lockfile && cd ../..

# CDK の依存関係をインストール
cd infra && bun install --frozen-lockfile && cd ..
```

### 3. Git フックのセットアップ

```bash
# lefthook フックを手動でインストール（bun install で自動実行されますが、念のため）
bun run prepare
```

これにより、以下の Git フックが自動的に設定されます：

- **pre-commit**: コミットに含める `frontend/` と `infra/lambda/` 配下の staged ファイルに対してフォーマットチェックと lint を実行
- **pre-push**: `frontend/**` または `infra/lambda/**` の変更があるときだけ、ビルドとテストを実行

## フロントエンド開発

```bash
# 開発サーバーの起動
bun run frontend:dev

# ビルド
bun run frontend:build

# Lint
bun run frontend:lint

# フォーマット
bun run frontend:format
```

フロントエンドの開発サーバー（Vite dev server）を起動後、API は一旦モック、または実際の API Gateway を叩く運用になります（CORS 設定が必要）。

## Lambda / バックエンド開発

```bash
# Lint
bun run lambda:lint

# フォーマット
bun run lambda:format

# ビルド
bun run lambda:build

# ウォッチモード
bun run lambda:watch
```

Lambda はローカルで直接実行して単体テストするか、`sam local` / `lambda-local` などのツールを使う方法があります。
基本的には「型・ユニットテスト＋実環境の dev ステージで動作確認」という運用でも対応可能です。

## リポジトリ全体のコマンド

```bash
# すべての lint 実行
bun run lint

# すべてのフォーマットチェック
bun run format:check

# フロントエンドと Lambda の型チェック
bun run type-check

# フロントエンドと Lambda のビルド
bun run build:all

# Lambda の単体テスト実行
bun run test
```

## インフラ変更時

DynamoDB のテーブル構造や Lambda 環境変数を変更した場合：

1. `docs/03-domain-and-data-model.md`（または [アーキテクチャ › データモデル](../architecture/data-model)）を更新
2. `cdk diff` で変更差分を確認
3. 問題なければ `cdk deploy` を実行

## Git フックについて

[lefthook](https://github.com/evilmartians/lefthook) を使用してローカルで CI 相当のチェックを自動実行します。
これにより、CI で失敗するケースを事前に防げます。

### フックをスキップする場合

```bash
git commit --no-verify  # pre-commit をスキップ
git push --no-verify    # pre-push をスキップ
```

> ⚠️ **注意**: フックをスキップすると、`frontend/**` や `infra/lambda/**` の変更を含む push では CI 失敗のリスクがあります。
