---
id: maintenance-troubleshooting
title: トラブルシューティング
sidebar_position: 2
---

## 概要

本番環境で問題が発生した場合の対処方法をまとめる。

---

## よくある問題と対処法

### フロントエンドが表示されない

**確認手順**

1. CloudFront ディストリビューションのステータスを確認する（AWS コンソール → CloudFront）
2. S3 バケットにファイルが正しくアップロードされているか確認する
3. ブラウザのコンソールにエラーがないか確認する

**よくある原因**

- S3 sync でファイルが正しくアップロードされていない → 再度 `aws s3 sync` を実行する
- CloudFront のキャッシュが古い → `create-invalidation` でキャッシュを無効化する
- 環境変数（`VITE_API_BASE_URL` 等）が正しく設定されていない → `frontend/.env.production` を確認する

---

### API が 401 / 403 エラーを返す

**確認手順**

1. Cognito の JWT トークンが有効期限切れでないか確認する
2. CloudWatch Logs で Lambda のログを確認する
3. API Gateway の設定（認証設定）を確認する

**よくある原因**

- `VITE_AUTH_TOKEN` が未設定、または localStorage に認証トークンが保存されていない → トークンを設定して再読み込みする
- 認証トークンが無効・期限切れになっている → 新しいトークンを取得して設定し直す

---

### API が 500 エラーを返す

**確認手順**

```bash
# Lambda のログを確認
aws logs tail /aws/lambda/<関数名> --follow
```

1. CloudWatch Logs でエラーメッセージと stack trace を確認する
2. DynamoDB テーブルが存在するか確認する（AWS コンソール → DynamoDB）
3. Lambda の環境変数（テーブル名等）が正しいか確認する

**よくある原因**

- DynamoDB テーブルが存在しない・テーブル名が間違っている → `cdk deploy` でインフラを再デプロイする
- Lambda のコードにバグがある → ログを確認して修正する

---

### CDK デプロイが失敗する

**確認手順**

```bash
# CloudFormation スタックのイベントを確認
aws cloudformation describe-stack-events \
  --stack-name <スタック名> \
  --query 'StackEvents[?ResourceStatus==`CREATE_FAILED` || ResourceStatus==`UPDATE_FAILED`]'
```

**よくある原因**

- IAM 権限が不足している → 使用している AWS 認証情報のポリシーを確認する
- CDK Bootstrap が未実行 → `cdk bootstrap` を実行する
- スタックが `ROLLBACK_COMPLETE` 状態になっている → スタックを削除してから再デプロイする

```bash
# スタックを削除（注意: DynamoDB テーブルが削除される可能性がある）
cdk destroy
```

> **TODO**: DynamoDB テーブルの削除保護（`RemovalPolicy.RETAIN`）設定の確認。

---

### ドキュメントサイトが更新されない

**確認手順**

1. GitHub Actions の `docs-deploy.yml` ワークフローが正常に完了しているか確認する（GitHub → Actions タブ）
2. `docs/**` 配下のファイルが変更に含まれているか確認する

**よくある原因**

- `docs/**` 以外のファイルのみ変更した場合はトリガーされない → `workflow_dispatch` で手動実行する
- Docusaurus のビルドエラーがある → Actions のログを確認する

---

## ログ確認コマンド集

```bash
# Lambda ログをリアルタイムで確認
aws logs tail /aws/lambda/<関数名> --follow

# 特定時間帯のログを確認（エポックミリ秒）
aws logs filter-log-events \
  --log-group-name /aws/lambda/<関数名> \
  --start-time 1700000000000 \
  --filter-pattern "ERROR"

# API Gateway のアクセスログ（設定している場合）
aws logs tail /aws/apigateway/<ステージ名> --follow
```
