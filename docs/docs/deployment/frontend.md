---
id: deployment-frontend
title: フロントエンドデプロイ
sidebar_position: 2
---

## 概要

フロントエンド（React SPA）は Vite でビルドし、S3 バケットに配置後、CloudFront 経由で配信する。

---

## 手動デプロイ手順

### 1. ビルド

```bash
# リポジトリ root で実行
npm run build:all
# または frontend のみビルド
cd frontend && npm run build
```

ビルド成果物は `frontend/dist/` に出力される。

### 2. S3 へのアップロード

```bash
aws s3 sync frontend/dist/ s3://<バケット名>/ --delete
```

- `--delete` オプションにより、S3 上の古いファイルが削除される
- `<バケット名>` は CDK デプロイ時に決まる値を使用する

> **TODO**: バケット名を確定後にここに記載する。

### 3. CloudFront キャッシュの無効化

```bash
aws cloudfront create-invalidation \
  --distribution-id <ディストリビューション ID> \
  --paths "/*"
```

- 静的ファイルを更新した場合はキャッシュを無効化する
- `index.html` のみ更新した場合でも `/*` を指定して全体を無効化するのが安全

> **TODO**: ディストリビューション ID を確定後にここに記載する。

---

## 環境変数

フロントエンドのビルドに必要な環境変数は `frontend/.env.production` で管理する。

| 変数名                             | 説明                                                           | 例                                                                    |
| ---------------------------------- | -------------------------------------------------------------- | --------------------------------------------------------------------- |
| `VITE_API_BASE_URL`                | API Gateway の URL                                             | `https://xxx.execute-api.ap-northeast-1.amazonaws.com`                |
| `VITE_COGNITO_USER_POOL_ID`        | Cognito User Pool ID                                           | `ap-northeast-1_xxxxxxxx`                                             |
| `VITE_COGNITO_CLIENT_ID`           | Cognito App Client ID                                          | `xxxxxxxxxxxxxxxxxxxxxxxxxx`                                          |
| `VITE_COGNITO_REGION`              | AWS リージョン                                                 | `ap-northeast-1`                                                      |
| `VITE_COGNITO_DOMAIN`              | Cognito Hosted UI ドメイン                                     | `cooking-planner-prod.auth.ap-northeast-1.amazoncognito.com`          |
| `VITE_COGNITO_REDIRECT_URI`        | ログイン後リダイレクト URI                                     | `https://example.com/callback`                                        |
| `VITE_COGNITO_LOGOUT_REDIRECT_URI` | ログアウト後リダイレクト URI                                   | `https://example.com`                                                 |
| `VITE_AUTH_TOKEN`                  | 認証トークンをローカル開発や暫定運用で直接指定する場合に使う値 | `eyJhbGciOi...`                                                       |

:::tip CDK Outputs からの値取得
CDK デプロイ後に出力される Outputs から各変数の値を確認できます。

```bash
aws cloudformation describe-stacks \
  --stack-name CookingPlanner-prod \
  --query "Stacks[0].Outputs" \
  --output table
```

| CDK Output キー     | 対応する環境変数               |
| ------------------- | ------------------------------ |
| `UserPoolId`        | `VITE_COGNITO_USER_POOL_ID`    |
| `UserPoolClientId`  | `VITE_COGNITO_CLIENT_ID`       |
| `UserPoolDomainName`| `VITE_COGNITO_DOMAIN`          |
:::

:::caution
`frontend/.env.production` はリポジトリにコミットしないように注意する。
実際の値は別途安全な場所に保管すること。
:::

---

## ロールバック

前バージョンの `dist/` をローカルに保持している場合は、同じ手順で古いビルドを S3 に再アップロードする。

> **TODO**: S3 バージョニングを有効にすることで、コンソールから以前のバージョンに戻す運用も検討する。
