#!/usr/bin/env bash
# deploy-frontend.sh
#
# フロントエンド（React SPA）を S3 にアップロードし、
# CloudFront キャッシュを無効化するデプロイスクリプト。
#
# 使い方:
#   ./scripts/deploy-frontend.sh [stage]
#
# 引数:
#   stage  デプロイ先の環境。"dev" または "prod"（デフォルト: prod）
#
# 前提条件:
#   - AWS CLI がインストールされ、認証情報が設定されていること
#   - CDK スタックがすでにデプロイ済みであること（S3 バケット・CloudFront が存在すること）
#   - Bun がインストールされていること（https://bun.sh）
#
# 取得する CDK Outputs:
#   - FrontendBucketName   : フロントエンド用 S3 バケット名
#   - CloudFrontDistributionId : CloudFront ディストリビューション ID

set -euo pipefail

STAGE="${1:-prod}"
case "${STAGE}" in
  dev|prod)
    ;;
  *)
    echo "ERROR: stage は 'dev' または 'prod' を指定してください: ${STAGE}" >&2
    echo "Usage: ./scripts/deploy-frontend.sh [dev|prod]" >&2
    exit 1
    ;;
esac
STACK_NAME="CookingPlanner-${STAGE}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "=== フロントエンドデプロイ開始 (stage: ${STAGE}) ==="

# ---- 1. CDK Outputs から S3 バケット名と CloudFront Distribution ID を取得 ----
echo ">>> CDK Outputs を取得しています..."

BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DISTRIBUTION_ID=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontDistributionId'].OutputValue" \
  --output text)

if [[ -z "${BUCKET_NAME}" || "${BUCKET_NAME}" == "None" ]]; then
  echo "ERROR: FrontendBucketName が CDK Outputs に見つかりません。cdk deploy を先に実行してください。" >&2
  exit 1
fi

if [[ -z "${DISTRIBUTION_ID}" || "${DISTRIBUTION_ID}" == "None" ]]; then
  echo "ERROR: CloudFrontDistributionId が CDK Outputs に見つかりません。cdk deploy を先に実行してください。" >&2
  exit 1
fi

echo "    S3 バケット         : ${BUCKET_NAME}"
echo "    CloudFront Distribution ID: ${DISTRIBUTION_ID}"

# ---- 2. フロントエンドビルド ----
echo ">>> フロントエンドをビルドしています..."
cd "${REPO_ROOT}/frontend"
bun run build
echo "    ビルド完了: frontend/dist/"

# ---- 3. S3 へのアップロード ----
echo ">>> S3 にアップロードしています..."
aws s3 sync "${REPO_ROOT}/frontend/dist/" "s3://${BUCKET_NAME}/" --delete
echo "    S3 アップロード完了"

# ---- 4. CloudFront キャッシュの無効化 ----
echo ">>> CloudFront キャッシュを無効化しています..."
INVALIDATION_ID=$(aws cloudfront create-invalidation \
  --distribution-id "${DISTRIBUTION_ID}" \
  --paths "/*" \
  --query "Invalidation.Id" \
  --output text)
echo "    無効化リクエスト作成完了 (ID: ${INVALIDATION_ID})"
echo "    ※ 無効化の完了には数分かかる場合があります"

echo ""
echo "=== フロントエンドデプロイ完了 ==="

# CloudFront URL を出力
CLOUDFRONT_URL=$(aws cloudformation describe-stacks \
  --stack-name "${STACK_NAME}" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" \
  --output text)
echo "    URL: ${CLOUDFRONT_URL}"
