# API Gateway 設定

このドキュメントでは、Cooking Planner アプリケーションの HTTP API を提供する API Gateway の CDK 設定を記載します。

## 概要

Amazon API Gateway HTTP API を使用して、Lambda 関数への HTTP エンドポイントを提供します。

## 基本設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| API 名 | `CookingPlanner-Api-{stage}` | stage は `prod` または `dev` |
| API タイプ | HTTP API | REST API より軽量で低コスト |
| 説明 | `Cooking Planner HTTP API` | API の用途 |

## CORS 設定

SPA からのアクセスを許可するため、CORS を設定しています。

| 項目 | 値 | 説明 |
|-----|-----|------|
| Allow Origins | `*`（dev/test）, CloudFront ドメイン（prod） | 開発時は簡便さ、本番ではフロント配信元に制限 |
| Allow Methods | GET, POST, PUT, DELETE, OPTIONS | 許可する HTTP メソッド |
| Allow Headers | Content-Type, Authorization | 許可するリクエストヘッダー |
| Max Age | 1日 (86400秒) | プリフライトリクエストのキャッシュ時間 |

### 本番環境での設定

本番環境では、CloudFront ドメインのみを許可：

```typescript
corsPreflight: {
  allowOrigins: ['https://d1234567890.cloudfront.net'],
  // ... 他の設定
}
```

## ルーティング設定

### プロキシ統合

すべてのパスを Lambda 関数にプロキシする設定を使用：

| パス | メソッド | 説明 |
|-----|-----|------|
| `/` | GET | ルートパス |
| `/health` | GET | 疎通確認用エンドポイント |
| `/{proxy+}` | GET, POST, PUT, DELETE | 認証必須の業務 API |

**注意**: `/{proxy+}` のみでは空のパス（ルートパス）にマッチしないため、明示的に `/` ルートを追加しています。これにより、API のルートエンドポイントへのリクエストも正しく Lambda に転送されます。

統合タイプ: Lambda プロキシ統合

この設定により、以下のようなパスがすべて Lambda に渡されます：
- `/recipes`
- `/recipes/123`
- `/menus`
- `/shopping-list`

Lambda 関数内で、パスとメソッドに基づいてルーティング処理を実装します。

## Lambda 統合の詳細

### 統合タイプ

HTTP Lambda Integration を使用：

```typescript
const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
  'LambdaIntegration',
  apiLambda
);
```

### Lambda への入力形式

API Gateway から Lambda に渡されるイベントオブジェクトの例：

```json
{
  "version": "2.0",
  "routeKey": "GET /recipes",
  "rawPath": "/recipes",
  "rawQueryString": "limit=10",
  "headers": {
    "authorization": "Bearer eyJ...",
    "content-type": "application/json"
  },
  "requestContext": {
    "http": {
      "method": "GET",
      "path": "/recipes",
      "protocol": "HTTP/1.1",
      "sourceIp": "1.2.3.4",
      "userAgent": "Mozilla/5.0..."
    },
    "requestId": "abc-123",
    "timeEpoch": 1234567890
  },
  "body": null,
  "isBase64Encoded": false
}
```

### Lambda からの出力形式

Lambda は以下の形式でレスポンスを返す必要があります：

```json
{
  "statusCode": 200,
  "headers": {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*"
  },
  "body": "{\"message\":\"Success\"}"
}
```

## エンドポイント URL

デプロイ後、以下の形式で API エンドポイント URL が発行されます：

```
https://xxxxxxxxxx.execute-api.{region}.amazonaws.com
```

この URL は CloudFormation Outputs として出力されます：

- Output名: `ApiEndpoint`
- Export名: `CookingPlanner-ApiEndpoint-{stage}`

## 認証設定

業務 API には Cognito JWT Authorizer を適用しています。`/health` と `/` は疎通確認用のため認証なしです。

```typescript
import { HttpJwtAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

const authorizer = new HttpJwtAuthorizer('CognitoAuthorizer', 
  `https://cognito-idp.{region}.amazonaws.com/{userPoolId}`, {
    jwtAudience: [userPoolClient.userPoolClientId],
  }
);

httpApi.addRoutes({
  path: '/{proxy+}',
  methods: [...],
  integration: lambdaIntegration,
  authorizer,
});
```

## ステージ設定

HTTP API は自動的にデフォルトステージ（`$default`）を作成します。

### カスタムドメイン（今後の拡張）

必要に応じて、カスタムドメインを設定可能：

```typescript
// Route 53 + ACM を使用したカスタムドメインの例
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { DomainName } from 'aws-cdk-lib/aws-apigatewayv2';

const certificate = acm.Certificate.fromCertificateArn(...);
const domainName = new DomainName(this, 'DomainName', {
  domainName: 'api.example.com',
  certificate,
});

httpApi.addStage('prod', {
  domainMapping: {
    domainName,
  },
});
```

## スロットリング設定

デフォルトのスロットリング制限：
- リクエストレート: 10,000 requests/秒
- バーストレート: 5,000 requests

個人利用のため、これらの制限で十分です。

## ロギング

### アクセスログ（今後の実装予定）

必要に応じて、CloudWatch Logs へのアクセスログ出力を設定可能：

```typescript
import * as logs from 'aws-cdk-lib/aws-logs';

const logGroup = new logs.LogGroup(this, 'ApiLogs', {
  retention: logs.RetentionDays.ONE_WEEK,
});

httpApi.addStage('default', {
  autoDeploy: true,
  accessLogSettings: {
    destinationArn: logGroup.logGroupArn,
    format: apigatewayv2.LoggingFormat.jsonWithStandardFields(),
  },
});
```

## メトリクス

CloudWatch で自動的に以下のメトリクスが収集されます：

- **Count**: API リクエスト数
- **4XXError**: クライアントエラー数
- **5XXError**: サーバーエラー数
- **IntegrationLatency**: Lambda 実行時間
- **Latency**: 全体のレスポンス時間

## CDK コード参照

### API Gateway の定義

```typescript
const httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
  apiName: `CookingPlanner-Api-${stage}`,
  description: 'Cooking Planner HTTP API',
  corsPreflight: {
    allowOrigins:
      stage === 'prod' ? [`https://${distribution.distributionDomainName}`] : ['*'],
    allowMethods: [
      apigatewayv2.CorsHttpMethod.GET,
      apigatewayv2.CorsHttpMethod.POST,
      apigatewayv2.CorsHttpMethod.PUT,
      apigatewayv2.CorsHttpMethod.DELETE,
      apigatewayv2.CorsHttpMethod.OPTIONS,
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: cdk.Duration.days(1),
  },
});
```

### Lambda 統合の追加

```typescript
const lambdaIntegration = new apigatewayv2Integrations.HttpLambdaIntegration(
  'LambdaIntegration',
  apiLambda
);

const jwtAuthorizer = new HttpJwtAuthorizer(
  'CognitoJwtAuthorizer',
  `https://cognito-idp.${this.region}.amazonaws.com/${userPool.userPoolId}`,
  {
    jwtAudience: [userPoolClient.userPoolClientId],
  }
);

httpApi.addRoutes({
  path: '/{proxy+}',
  methods: [
    apigatewayv2.HttpMethod.GET,
    apigatewayv2.HttpMethod.POST,
    apigatewayv2.HttpMethod.PUT,
    apigatewayv2.HttpMethod.DELETE,
  ],
  integration: lambdaIntegration,
  authorizer: jwtAuthorizer,
});
```

## セキュリティ考慮事項

### 現在の状態
- dev/test は CORS で全オリジン許可
- prod は CloudFront ドメインのみに CORS を制限
- 業務 API は Cognito JWT Authorizer で保護

### 本番運用前に必要な対応
1. アクセスログの有効化
2. レートリミットの検討（必要に応じて）

## 参考資料

- [API 設計](/docs/04-api-design.md)
- [アーキテクチャ構成](/docs/05-architecture-notes.md)
- [AWS API Gateway HTTP API ドキュメント](https://docs.aws.amazon.com/apigateway/latest/developerguide/http-api.html)
