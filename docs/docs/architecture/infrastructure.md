---
id: infrastructure
title: インフラストラクチャ
sidebar_position: 5
---

# インフラストラクチャ

## 環境構成

### 想定環境

- `dev`（任意）：開発中に使う環境（必要であれば）
- `prod`：本番環境（実際に自分が使う環境）

個人開発のため、最初は `prod` のみでもよい。
CDK 上では `stage`（例：`dev` or `prod`）をパラメータとして扱えるようにしておくと、
後で環境を分けたくなった際に便利。

---

## 設定値 / 環境変数

### フロントエンド側

`frontend/.env` で管理（→ 詳細は [フロントエンド](frontend) を参照）

### Lambda / API 側

Lambda の環境変数として設定：

| 変数名 | 説明 |
|---|---|
| `RECIPES_TABLE_NAME` | Recipes テーブル名 |
| `RECIPE_INGREDIENTS_TABLE_NAME` | RecipeIngredients テーブル名 |
| `MENUS_TABLE_NAME` | Menus テーブル名 |
| `PANTRY_ITEMS_TABLE_NAME` | PantryItems テーブル名（将来） |
| `NODE_ENV` / `LOG_LEVEL` | 必要に応じて追加 |

CDK スタック内で DynamoDB テーブル生成時に名前を決め、その名前を Lambda の環境変数として渡す。

---

## デプロイ / CI の方針（初期）

### 手動デプロイ（初期想定）

**フロントエンド**

```bash
# ビルド
npm run build

# S3 へ同期
aws s3 sync dist/ s3://<bucket>/

# CloudFront のキャッシュ無効化（必要に応じて）
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

**バックエンド & インフラ**

```bash
# CDK プロジェクトで変更差分を確認
cdk diff

# デプロイ
cdk deploy
```

Lambda コードは CDK 経由でデプロイ（`NodejsFunction` など）。

### CI/CD（余裕があれば）

GitHub Actions で、main ブランチへの push / PR マージ時に

- `npm test` / `npm run lint` を実行
- CDK デプロイ
- フロントのビルド＆S3 デプロイ

を自動化する。

---

## ログ・監視

### CloudWatch Logs

- Lambda の標準出力（`console.log`, `console.error`）を CloudWatch Logs に送信。
- ログ設計（初期方針）：
    - API リクエストごとに最低限の情報を出す：
        - HTTP メソッド
        - パス
        - userId（わかる範囲で）
        - ステータスコード
    - エラー時に stack trace を出力（ただし機微情報は含めない）

### メトリクス

- 初期段階では、細かいアラートは不要。
- 必要になれば：
    - Lambda のエラーレート
    - API Gateway の 5xx レート
      に CloudWatch アラーム設定を検討。

---

## 今後のアーキ面での拡張余地（メモ）

- `Menus` の期間クエリ効率向上のための GSI 追加
- 単一テーブル設計（Single Table Design）への移行
    - 例：`PK: userId, SK: <entityType>#<id>...`
- PWA 対応（オフラインでの買い物リスト利用）
- CloudFront Functions / Lambda@Edge を使ったより細かいルーティングや認証前処理
- 家族など複数ユーザー利用を見据えた権限管理（role ベースなど）
