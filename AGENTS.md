# AGENTS.md

このリポジトリでは、共通ルールはこのファイル、領域固有のルールは `frontend/AGENTS.md` と `infra/lambda/AGENTS.md` に記載します。

## プロジェクト概要

- 個人用の料理レシピ／献立／買い物リスト管理アプリです。
- 仕様のソースオブトゥルースは `docs/` 配下の Markdown です。
- フロントエンドは Vite + React + TypeScript です。
- バックエンドは AWS Lambda + API Gateway + DynamoDB です。
- 認証は Amazon Cognito User Pool を前提とします。
- インフラは AWS CDK で管理します。

## 作業前の確認

- 実装前に、変更に関係する `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` を確認してください。
- `docs/` とコードが矛盾する場合は、原則として `docs/` を優先してください。
- 仕様変更を伴う場合は、関連する `docs/*.md` の更新要否も確認してください。

## 出力ルール

- Issue、PR、レビューコメント、コミットメッセージ、要約は日本語で書いてください。

## Git / PR ワークフロー

- ユーザーからの指示に対応する Issue がまだなければ、作業前に Issue を作成してください。
- Issue タイトルは日本語で簡潔に書き、Conventional Commits の prefix は付けません。
- `enhancement`、`bug`、`documentation` など適切なラベルを付けてください。
- ブランチは `gh issue develop <Issue番号> --name <Issue番号>-<説明> --base <ベースブランチ> --checkout` で作成してください。
- ベースブランチは通常 `main` を使います。
- 実装後に PR を作成してください。
- PR タイトルは対応する Issue と同じにしてください。
- PR 作成時は `--label` で適切なラベルを付け、本文に `closes #N` を含めてください。
- PR 本文は `.github/PULL_REQUEST_TEMPLATE.md` に従って記載してください。

## よく使うコマンド

- `npm run lint`
- `npm run format:check`
- `npm run type-check`
- `npm run build:all`
- `npm run test`

## 領域別ルール

- フロントエンド配下は `frontend/AGENTS.md` を参照してください。
- Lambda 配下は `infra/lambda/AGENTS.md` を参照してください。
