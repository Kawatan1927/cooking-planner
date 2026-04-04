---
id: maintenance-dependency-update
title: 依存関係の更新方針
sidebar_position: 1
---

## 概要

個人利用アプリのため、依存関係の更新は定期的かつ手動で行う。
セキュリティ上重要なアップデートは優先的に対応する。

---

## 更新頻度の目安

| 種別 | 頻度 | 対応方針 |
|---|---|---|
| セキュリティ修正（critical / high） | 発見次第 | 優先対応（1〜2 日以内） |
| セキュリティ修正（medium 以下） | 月次 | 定期更新時にまとめて対応 |
| 機能追加・バグ修正 | 月次〜四半期 | 破壊的変更がないか確認してから更新 |
| メジャーバージョンアップ | 半年〜年次 | マイグレーションガイドを確認してから対応 |

---

## 更新手順

### 1. 更新可能なパッケージの確認

```bash
# フロントエンド
(cd frontend && npm outdated)

# Lambda
(cd infra/lambda && npm outdated)

# ドキュメント
(cd docs && npx npm-check-updates)
```

### 2. パッチ・マイナーアップデート

```bash
# フロントエンド（patch / minor のみ）
(cd frontend && npm update)

# Lambda
(cd infra/lambda && npm update)

# ドキュメント
(cd docs && bun update)
```

### 3. メジャーアップデート

メジャーバージョンのアップデートは個別に対応する。
公式マイグレーションガイドを確認し、破壊的変更がある場合はコードを修正してからアップデートする。

```bash
# フロントエンドの特定パッケージを更新
(cd frontend && npm install <パッケージ名>@<バージョン>)

# Lambda の特定パッケージを更新
(cd infra/lambda && npm install <パッケージ名>@<バージョン>)

# ドキュメントの特定パッケージを更新
(cd docs && bun add <パッケージ名>@<バージョン>)
```

`docs/package.json` を更新した場合は、`bun.lock` も同時に更新されていることを必ず確認する。

### 4. テスト・ビルド確認

```bash
npm run build:all
npm run test
npm run lint
```

---

## セキュリティ脆弱性の確認

### GitHub Dependabot

リポジトリで Dependabot アラートが有効な場合、脆弱性が検出されると Issues / Pull Requests が自動作成される。

### npm audit

```bash
# フロントエンド
(cd frontend && npm audit)

# Lambda
(cd infra/lambda && npm audit)

# 自動修正を試みる場合
(cd frontend && npm audit fix)
(cd infra/lambda && npm audit fix)
```

---

## 主要依存パッケージ

### フロントエンド

| パッケージ | 用途 |
|---|---|
| React | UI ライブラリ |
| Vite | ビルドツール |
| TypeScript | 型付き JavaScript |
| aws-amplify / amazon-cognito-identity-js | Cognito 認証 |

### Lambda

| パッケージ | 用途 |
|---|---|
| `@aws-sdk/client-dynamodb` | DynamoDB 操作 |
| `@aws-sdk/lib-dynamodb` | DynamoDB Document Client |
| TypeScript | 型付き JavaScript |

### インフラ

| パッケージ | 用途 |
|---|---|
| `aws-cdk-lib` | CDK コア |
| `constructs` | CDK コンストラクト |

> **TODO**: CDK スタックの実装が完了した際に具体的なパッケージ一覧を更新する。
