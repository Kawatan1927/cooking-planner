---
id: deployment-backend
title: バックエンドデプロイ
sidebar_position: 3
---

## 概要

バックエンド（Lambda + API Gateway）およびインフラ（DynamoDB、Cognito 等）は AWS CDK で管理する方針とする。
変更は `cdk deploy` コマンドでデプロイする運用を想定している。

`infra/lib/cooking-planner-stack.ts` に CDK スタックが実装されており、現時点では以下のリソースが定義されている。

| リソース                     | 説明                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| DynamoDB テーブル            | Recipes / RecipeIngredients / Menus                          |
| Lambda 関数                  | `cooking-planner-api-{stage}`（Node.js 20、TypeScript）      |
| API Gateway HTTP API         | `cooking-planner-api-{stage}`（Cognito JWT Authorizer 付き） |
| Cognito User Pool            | `cooking-planner-{stage}-user-pool`                          |
| Cognito User Pool App Client | SPA から SRP 認証フローで使用                                |

S3 + CloudFront などのリソースは今後の Issue で順次追加予定。

---

## 手動デプロイ手順

### 1. 差分確認

```bash
cd infra
cdk diff
```

- 意図しないリソースの変更・削除が含まれていないことを必ず確認する
- DynamoDB テーブルの削除（`DESTROY` ポリシー）には特に注意する

### 2. デプロイ実行

```bash
cd infra
cdk deploy
```

- Lambda コードのバンドルと API Gateway・DynamoDB 等のリソース更新が一括で行われる
- デプロイ完了後、出力（Outputs）に API Gateway の URL 等が表示される

### 3. Lambda のみ更新する場合

インフラ変更なしで Lambda コードだけ更新する場合も `cdk deploy` を使用する。
CDK が差分を検出して Lambda 関数のみ更新する。

---

## 環境変数（Lambda）

Lambda の環境変数は CDK スタック内で定義し、DynamoDB テーブル名等を自動的に渡す。
手動で変更する必要は基本的にない。

| 変数名                          | 説明                           |
| ------------------------------- | ------------------------------ |
| `RECIPES_TABLE_NAME`            | Recipes テーブル名             |
| `RECIPE_INGREDIENTS_TABLE_NAME` | RecipeIngredients テーブル名   |
| `MENUS_TABLE_NAME`              | Menus テーブル名               |
| `PANTRY_ITEMS_TABLE_NAME`       | PantryItems テーブル名（将来） |

---

## CDK Bootstrap（初回のみ）

AWS アカウント・リージョンで CDK を初めて使う場合は以下を実行する。

```bash
cdk bootstrap aws://<アカウント ID>/<リージョン>
# 例
cdk bootstrap aws://123456789012/ap-northeast-1
```

---

## ロールバック

CDK のデプロイは CloudFormation 経由で行われるため、デプロイ失敗時には CloudFormation の自動ロールバック機能が既定で有効になっている。
ただし、過去の正常な状態へ明示的に戻すための簡易なロールバックコマンドは用意されていないため、前のバージョンに戻すには対象コミットをチェックアウトして再度 `cdk deploy` を実行する。

```bash
git checkout <前のコミット SHA>
cd infra
cdk deploy
```

> **TODO**: CloudFormation スタックのロールバック（`aws cloudformation cancel-update-stack`）も選択肢として検討する。

---

## CDK Outputs（デプロイ完了後）

`cdk deploy` 完了後、以下の値が CloudFormation Outputs として表示される。フロントエンドの環境変数設定に使用する。

| Output キー        | 用途                                                                  |
| ------------------ | --------------------------------------------------------------------- |
| `HttpApiUrl`       | API Gateway HTTP API エンドポイント URL（`VITE_API_BASE_URL` に設定） |
| `UserPoolId`       | Cognito User Pool ID（`VITE_COGNITO_USER_POOL_ID` に設定）            |
| `UserPoolClientId` | Cognito App Client ID（`VITE_COGNITO_CLIENT_ID` に設定）              |

---

## CORS の設定

API Gateway の CORS 設定は CDK デプロイ時に `allowedOrigins` context で指定する。

```bash
# dev 環境：省略可（デフォルト: http://localhost:5173）
npx cdk deploy --context stage=dev

# prod 環境：必須。'*' は使用不可
npx cdk deploy --context stage=prod --context allowedOrigins=https://xxx.cloudfront.net
```

> **注意**: prod 環境で `allowedOrigins` を省略・空・`*` に設定した場合、`cdk synth` / `cdk deploy` 時にエラーとなる（fail-closed 設計）。

---

## API エンドポイント一覧（現行実装）

| メソッド | パス                  | 認証     | 説明                      |
| -------- | --------------------- | -------- | ------------------------- |
| GET      | `/health`             | 不要     | 疎通確認（status / time） |
| GET      | `/recipes`            | JWT 必須 | レシピ一覧取得            |
| POST     | `/recipes`            | JWT 必須 | レシピ作成                |
| GET      | `/recipes/{recipeId}` | JWT 必須 | レシピ詳細取得            |

その他のエンドポイント（`/menus`、`/shopping-list` 等）は今後の Issue で追加予定。
