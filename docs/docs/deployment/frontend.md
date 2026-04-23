---
id: deployment-frontend
title: フロントエンドデプロイ
sidebar_position: 2
---

## 概要

フロントエンド（React SPA）は Vite でビルドし、S3 バケットに配置後、CloudFront 経由で配信する。

CloudFront ディストリビューションは `/api/*` リクエストを API Gateway に転送し、
その他すべてのリクエストを S3 の静的ファイルで応答する。
SPA ルーティングのために、S3 から 403/404 が返った場合は `index.html` にフォールバックする。

---

## 手動デプロイ手順

### 0. 事前確認

CDK スタックがデプロイ済みであること（S3 バケット・CloudFront ディストリビューションが作成されていること）を確認する。

```bash
aws cloudformation describe-stacks \
  --stack-name CookingPlanner-prod \
  --query "Stacks[0].Outputs" \
  --output table
```

### 1. スクリプトによるデプロイ（推奨）

リポジトリに含まれる `scripts/deploy-frontend.sh` を使うと、ビルド・S3 アップロード・キャッシュ無効化を一括で実行できる。

```bash
# prod 環境へデプロイ
./scripts/deploy-frontend.sh prod

# dev 環境へデプロイ
./scripts/deploy-frontend.sh dev
```

スクリプトは CDK Outputs から自動的に S3 バケット名と CloudFront Distribution ID を取得する。

### 2. 手動でのステップ実行

スクリプトを使わずに手順を個別に実行する場合は以下の通り。

#### 2-1. ビルド

```bash
# リポジトリ root で実行
npm run frontend:build
# または frontend のみビルド
cd frontend && npm run build
```

ビルド成果物は `frontend/dist/` に出力される。

#### 2-2. S3 へのアップロード

```bash
# CDK Outputs から S3 バケット名を取得
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name CookingPlanner-prod \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

aws s3 sync frontend/dist/ s3://${BUCKET_NAME}/ --delete
```

- `--delete` オプションにより、S3 上の古いファイルが削除される

#### 2-3. CloudFront キャッシュの無効化

```bash
# CDK Outputs から Distribution ID を取得
DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name CookingPlanner-prod \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"
```

- 静的ファイルを更新した場合はキャッシュを無効化する
- `index.html` のみ更新した場合でも `/*` を指定して全体を無効化するのが安全

---

## 環境変数

ビルド前に `frontend/.env.production` を作成し、CDK Outputs の値を設定する。

```bash
# frontend/.env.production（例）
VITE_API_BASE_URL=https://<CloudFrontUrl の値>/api
VITE_COGNITO_USER_POOL_ID=ap-northeast-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
VITE_COGNITO_REGION=ap-northeast-1
VITE_COGNITO_DOMAIN=cooking-planner-prod.auth.ap-northeast-1.amazoncognito.com
VITE_COGNITO_REDIRECT_URI=https://<CloudFrontUrl の値>/callback
VITE_COGNITO_LOGOUT_REDIRECT_URI=https://<CloudFrontUrl の値>
```

| 変数名                             | 説明                                                     | CDK Output キー               |
| ---------------------------------- | -------------------------------------------------------- | ----------------------------- |
| `VITE_API_BASE_URL`                | `<CloudFrontUrl>/api` の形式で設定する                   | `CloudFrontUrl` + `/api`      |
| `VITE_COGNITO_USER_POOL_ID`        | Cognito User Pool ID                                     | `UserPoolId`                  |
| `VITE_COGNITO_CLIENT_ID`           | Cognito App Client ID                                    | `UserPoolClientId`            |
| `VITE_COGNITO_REGION`              | AWS リージョン                                           | （デプロイ時のリージョン）    |
| `VITE_COGNITO_DOMAIN`              | Cognito Hosted UI ドメイン                               | `UserPoolDomainName`          |
| `VITE_COGNITO_REDIRECT_URI`        | ログイン後リダイレクト URI（`<CloudFrontUrl>/callback`） | `CloudFrontUrl` + `/callback` |
| `VITE_COGNITO_LOGOUT_REDIRECT_URI` | ログアウト後リダイレクト URI（`<CloudFrontUrl>`）        | `CloudFrontUrl`               |

:::tip CDK Outputs の一覧確認

```bash
aws cloudformation describe-stacks \
  --stack-name CookingPlanner-prod \
  --query "Stacks[0].Outputs" \
  --output table
```

:::

:::caution
`frontend/.env.production` はリポジトリにコミットしないように注意する。
実際の値は別途安全な場所に保管すること。
:::

---

## ロールバック

前バージョンの `dist/` をローカルに保持している場合は、同じ手順で古いビルドを S3 に再アップロードする。
