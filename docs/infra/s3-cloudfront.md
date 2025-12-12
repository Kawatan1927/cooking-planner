# S3 + CloudFront 設定

このドキュメントでは、Cooking Planner アプリケーションのフロントエンド（SPA）を配信するための S3 バケットと CloudFront ディストリビューションの CDK 設定を記載します。

## 概要

React SPA をホスティングするために、S3 バケットで静的ファイルを保存し、CloudFront を通じて HTTPS で配信します。

## S3 バケット設定

### 基本設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| バケット名 | `cooking-planner-frontend-{stage}-{accountId}` | グローバルに一意な名前 |
| パブリックアクセス | ブロック | CloudFront 経由でのみアクセス可能 |
| Website Hosting | 有効 | SPA 用の設定 |
| Index Document | `index.html` | デフォルトドキュメント |
| Error Document | `index.html` | SPA ルーティング用 |
| Removal Policy (prod) | RETAIN | 本番環境ではスタック削除時もバケットを保持 |
| Removal Policy (dev) | DESTROY | 開発環境ではスタック削除時に削除 |
| Auto Delete Objects (dev) | 有効 | 開発環境ではバケット削除時にオブジェクトも削除 |

### バケット名の構成要素

- `cooking-planner-frontend`: 固定のプレフィックス
- `{stage}`: 環境名（`prod` または `dev`）
- `{accountId}`: AWS アカウント ID（グローバルユニーク性を確保）

例: `cooking-planner-frontend-prod-123456789012`

### パブリックアクセスブロック

セキュリティのため、すべてのパブリックアクセスをブロックしています：

| 設定 | 値 |
|-----|-----|
| BlockPublicAcls | true |
| BlockPublicPolicy | true |
| IgnorePublicAcls | true |
| RestrictPublicBuckets | true |

CloudFront からのアクセスは Origin Access Identity (OAI) を通じて許可されます。

## CloudFront Distribution 設定

### 基本設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| オリジン | S3 バケット | フロントエンドファイルのソース |
| Origin Access Identity | 有効 | S3 へのセキュアなアクセス |
| Default Root Object | `index.html` | ルートパスでのデフォルトファイル |
| Viewer Protocol Policy | HTTPS のみ | HTTP を HTTPS にリダイレクト |

### Origin Access Identity (OAI)

CloudFront から S3 バケットへのアクセスを制御する特別な ID です。

- S3 バケットポリシーで OAI からの読み取りを許可
- インターネットからの直接アクセスは不可
- CloudFront 経由でのみアクセス可能

### キャッシュ設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| Allowed Methods | GET, HEAD, OPTIONS | 読み取り専用メソッド |
| Cached Methods | GET, HEAD, OPTIONS | キャッシュ対象のメソッド |

### エラーレスポンス設定

SPA のクライアントサイドルーティングをサポートするため、404/403 エラーを `index.html` にリダイレクト：

| HTTP Status | レスポンス | レスポンスページ | TTL |
|------------|-----------|----------------|-----|
| 404 | 200 OK | /index.html | 5分 |
| 403 | 200 OK | /index.html | 5分 |

#### エラーレスポンスの動作

1. ユーザーが `/recipes/123` にアクセス
2. S3 に `/recipes/123` ファイルが存在しない → 404
3. CloudFront が自動的に `/index.html` を返す（200 OK）
4. React Router が `/recipes/123` をクライアント側でルーティング

## デプロイワークフロー

### フロントエンドのビルドとデプロイ

```bash
# 1. フロントエンドのビルド
cd frontend
npm run build

# 2. S3 にアップロード
aws s3 sync dist/ s3://cooking-planner-frontend-prod-123456789012/ --delete

# 3. CloudFront のキャッシュ無効化（必要に応じて）
aws cloudfront create-invalidation \
  --distribution-id E1234567890ABC \
  --paths "/*"
```

### デプロイスクリプトの例

`frontend/deploy.sh`:

```bash
#!/bin/bash
set -e

STAGE=${1:-prod}
BUCKET_NAME=$(aws cloudformation describe-stacks \
  --stack-name CookingPlannerStack-${STAGE} \
  --query "Stacks[0].Outputs[?OutputKey=='FrontendBucketName'].OutputValue" \
  --output text)

DISTRIBUTION_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Comment=='Cooking Planner ${STAGE}'].Id" \
  --output text)

echo "Building frontend..."
npm run build

echo "Uploading to S3: ${BUCKET_NAME}"
aws s3 sync dist/ s3://${BUCKET_NAME}/ --delete

echo "Invalidating CloudFront cache: ${DISTRIBUTION_ID}"
aws cloudfront create-invalidation \
  --distribution-id ${DISTRIBUTION_ID} \
  --paths "/*"

echo "Deploy complete!"
```

## アクセス URL

デプロイ後、以下の形式で CloudFront URL が発行されます：

```
https://d1234567890abc.cloudfront.net
```

この URL は CloudFormation Outputs として出力されます：

- Output名: `DistributionDomainName`
- Export名: `CookingPlanner-DistributionDomain-{stage}`

## カスタムドメインの設定（今後の拡張）

独自ドメインを使用する場合の設定例：

### 必要なリソース

1. Route 53 でドメインを管理
2. ACM で SSL/TLS 証明書を発行（us-east-1 リージョン）
3. CloudFront にカスタムドメインを設定
4. Route 53 で A レコード（Alias）を作成

### CDK での実装例

```typescript
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';

// ACM 証明書（us-east-1 で作成済みと仮定）
const certificate = acm.Certificate.fromCertificateArn(
  this,
  'Certificate',
  'arn:aws:acm:us-east-1:123456789012:certificate/...'
);

// CloudFront にカスタムドメインを追加
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  // ... 既存の設定
  domainNames: ['app.example.com'],
  certificate: certificate,
});

// Route 53 でエイリアスレコードを作成
const zone = route53.HostedZone.fromLookup(this, 'Zone', {
  domainName: 'example.com',
});

new route53.ARecord(this, 'AliasRecord', {
  zone,
  recordName: 'app',
  target: route53.RecordTarget.fromAlias(
    new targets.CloudFrontTarget(distribution)
  ),
});
```

## パフォーマンス最適化

### キャッシュ戦略

現在の設定では、CloudFront のデフォルトキャッシュ動作を使用していますが、最適化のために以下を検討可能：

#### ファイルタイプ別のキャッシュ設定

```typescript
// ハッシュ付きのアセットは長期キャッシュ
// /assets/main.abc123.js など
const distribution = new cloudfront.Distribution(this, 'Distribution', {
  additionalBehaviors: {
    '/assets/*': {
      origin: s3Origin,
      viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      // TTL: 1年
    },
  },
  // index.html は短いキャッシュ
  defaultBehavior: {
    // ... 既存の設定
    cachePolicy: new cloudfront.CachePolicy(this, 'IndexCachePolicy', {
      defaultTtl: cdk.Duration.minutes(5),
      maxTtl: cdk.Duration.hours(1),
    }),
  },
});
```

### 圧縮

CloudFront の自動圧縮を有効化することで、転送サイズを削減可能：

```typescript
defaultBehavior: {
  // ... 既存の設定
  compress: true, // gzip/brotli 圧縮を有効化
}
```

## セキュリティ

### HTTPS 強制

すべての HTTP リクエストを HTTPS にリダイレクトします：

```typescript
viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS
```

### セキュリティヘッダーの追加（推奨）

CloudFront Functions を使用してセキュリティヘッダーを追加可能：

```typescript
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

const securityHeadersFunction = new cloudfront.Function(this, 'SecurityHeaders', {
  code: cloudfront.FunctionCode.fromInline(`
    function handler(event) {
      var response = event.response;
      response.headers = response.headers || {};
      
      response.headers['strict-transport-security'] = { 
        value: 'max-age=63072000; includeSubdomains; preload' 
      };
      response.headers['x-content-type-options'] = { value: 'nosniff' };
      response.headers['x-frame-options'] = { value: 'DENY' };
      response.headers['x-xss-protection'] = { value: '1; mode=block' };
      response.headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };
      
      return response;
    }
  `),
});

// Distribution に適用
defaultBehavior: {
  // ... 既存の設定
  functionAssociations: [{
    function: securityHeadersFunction,
    eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
  }],
}
```

## コスト最適化

### 現在の構成でのコスト

個人利用の想定で、月間コストは非常に低額です：

- **S3**: ストレージ料金（数MB程度）+ リクエスト料金（CloudFront 経由のみ）
- **CloudFront**: データ転送料金（最初の10TB は $0.085/GB）

### 無料枠

AWS 無料枠（初年度）：
- CloudFront: 50GB のデータ転送 + 2,000,000 件の HTTP/HTTPS リクエスト

## モニタリング

CloudWatch で以下のメトリクスを監視可能：

### S3 メトリクス
- バケットサイズ
- オブジェクト数

### CloudFront メトリクス
- リクエスト数
- バイト転送量
- エラーレート（4xx, 5xx）
- キャッシュヒット率

## CDK コード参照

### S3 バケットの定義

```typescript
const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
  bucketName: `cooking-planner-frontend-${stage}-${this.account}`,
  websiteIndexDocument: 'index.html',
  websiteErrorDocument: 'index.html',
  publicReadAccess: false,
  blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  autoDeleteObjects: stage !== 'prod',
});
```

### CloudFront Distribution の定義

```typescript
const originAccessIdentity = new cloudfront.OriginAccessIdentity(this, 'OAI', {
  comment: `OAI for Cooking Planner ${stage}`,
});

frontendBucket.grantRead(originAccessIdentity);

const distribution = new cloudfront.Distribution(this, 'Distribution', {
  defaultBehavior: {
    origin: new origins.S3Origin(frontendBucket, {
      originAccessIdentity,
    }),
    viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
    allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
    cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
  },
  defaultRootObject: 'index.html',
  errorResponses: [
    {
      httpStatus: 404,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.minutes(5),
    },
    {
      httpStatus: 403,
      responseHttpStatus: 200,
      responsePagePath: '/index.html',
      ttl: cdk.Duration.minutes(5),
    },
  ],
});
```

### CloudFormation Outputs

```typescript
new cdk.CfnOutput(this, 'DistributionDomainName', {
  value: distribution.distributionDomainName,
  description: 'CloudFront Distribution Domain Name',
  exportName: `CookingPlanner-DistributionDomain-${stage}`,
});

new cdk.CfnOutput(this, 'FrontendBucketName', {
  value: frontendBucket.bucketName,
  description: 'Frontend S3 Bucket Name',
  exportName: `CookingPlanner-FrontendBucket-${stage}`,
});
```

## トラブルシューティング

### よくある問題

**Q: CloudFront 経由でアクセスすると 403 エラーが出る**
A: OAI の設定とバケットポリシーを確認してください。`frontendBucket.grantRead(originAccessIdentity)` が正しく設定されているか確認します。

**Q: SPA のルーティングが動作しない（リロードすると 404 になる）**
A: エラーレスポンス設定が正しく適用されているか確認してください。404/403 を index.html にリダイレクトする設定が必要です。

**Q: 更新したファイルが反映されない**
A: CloudFront のキャッシュが原因です。`aws cloudfront create-invalidation` でキャッシュを無効化してください。

## 参考資料

- [アーキテクチャ構成](/docs/05-architecture-notes.md)
- [Amazon S3 ドキュメント](https://docs.aws.amazon.com/s3/)
- [Amazon CloudFront ドキュメント](https://docs.aws.amazon.com/cloudfront/)
