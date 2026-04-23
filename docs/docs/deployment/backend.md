---
id: deployment-backend
title: バックエンドデプロイ
sidebar_position: 3
---

## 概要

バックエンド（Lambda + API Gateway）およびインフラ（DynamoDB、Cognito、S3+CloudFront 等）は AWS CDK で管理する。
変更は `cdk deploy` コマンドでデプロイする運用を想定している。

`infra/lib/cooking-planner-stack.ts` に CDK スタックが実装されており、以下のリソースが定義されている：

- DynamoDB テーブル（Recipes / RecipeIngredients / Menus）
- Lambda 関数（API ハンドラ）
- API Gateway HTTP API（Cognito JWT Authorizer 付き）
- Cognito User Pool / App Client / Hosted UI ドメイン
- S3 バケット（フロントエンド静的ファイル用）
- CloudFront ディストリビューション（SPA 配信 + `/api/*` → API Gateway ルーティング）

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
# dev 環境
cdk deploy --context stage=dev

# prod 環境（allowedOrigins / callbackUrls / logoutUrls が必須）
cdk deploy \
  --context stage=prod \
  --context allowedOrigins=https://xxx.cloudfront.net \
  --context callbackUrls=https://xxx.cloudfront.net/callback \
  --context logoutUrls=https://xxx.cloudfront.net
```

- Lambda コードのバンドルと API Gateway・DynamoDB・S3・CloudFront 等のリソース更新が一括で行われる
- デプロイ完了後、出力（Outputs）に以下の値が表示される

| CDK Output キー            | 説明                                                        |
| -------------------------- | ----------------------------------------------------------- |
| `HttpApiUrl`               | API Gateway HTTP API エンドポイント URL                     |
| `CloudFrontUrl`            | CloudFront URL（`VITE_API_BASE_URL` と Cognito URL に使用） |
| `CloudFrontDistributionId` | CloudFront Distribution ID（キャッシュ無効化に使用）        |
| `FrontendBucketName`       | フロントエンド用 S3 バケット名（`aws s3 sync` に使用）      |
| `UserPoolId`               | Cognito User Pool ID                                        |
| `UserPoolClientId`         | Cognito App Client ID                                       |
| `UserPoolDomainName`       | Cognito Hosted UI ドメイン名                                |

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
