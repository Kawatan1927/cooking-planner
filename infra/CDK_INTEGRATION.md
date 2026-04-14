# CDK から Lambda をデプロイする方法

## 概要

`infra/lib/cooking-planner-stack.ts` に CDK スタックが実装されており、`NodejsFunction` を使って TypeScript ソースを自動バンドルしてデプロイする。

現在のスタックには以下のリソースが含まれる:
- DynamoDB テーブル（Recipes / RecipeIngredients / Menus）
- Lambda 関数（Node.js 20、TypeScript）
- API Gateway HTTP API（Cognito JWT Authorizer 付き）
- Cognito User Pool / App Client

## Lambda 関数定義（現行実装）

`NodejsFunction` を使用して TypeScript ソースを esbuild で自動バンドルする。
`@aws-sdk/*` は Node.js 20 ランタイムに同梱されているため外部化する。

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

this.apiHandler = new NodejsFunction(this, 'ApiHandler', {
  functionName: `cooking-planner-api-${this.stage}`,
  entry: path.join(__dirname, '../lambda/src/index.ts'),
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_20_X,
  environment: {
    RECIPES_TABLE_NAME: this.recipesTable.tableName,
    RECIPE_INGREDIENTS_TABLE_NAME: this.recipeIngredientsTable.tableName,
    MENUS_TABLE_NAME: this.menusTable.tableName,
    // PANTRY_ITEMS_TABLE_NAME は将来の拡張用（現時点では未実装）
  },
  bundling: {
    externalModules: ['@aws-sdk/*'],
  },
});
```

`NodejsFunction` を使うため、手動での `npm run lambda:build` は不要。CDK デプロイ時に自動でビルドされる。

## API Gateway との統合

### CORS 設定（fail-closed 設計）

prod 環境では `allowedOrigins` の検証を厳格に行う。

```typescript
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { HttpUserPoolAuthorizer } from 'aws-cdk-lib/aws-apigatewayv2-authorizers';

// allowedOrigins のバリデーション（prod: 必須・'*' 禁止）
// → infra/bin/cooking-planner.ts / infra/lib/cooking-planner-stack.ts を参照

this.httpApi = new apigatewayv2.HttpApi(this, 'HttpApi', {
  apiName: `cooking-planner-api-${this.stage}`,
  corsPreflight: {
    allowOrigins: corsAllowOrigins, // dev: ['http://localhost:5173'], prod: 明示的な CloudFront URL
    allowMethods: [apigatewayv2.CorsHttpMethod.ANY],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});
```

> **注意**: prod 環境で `allowedOrigins` を省略・空・`'*'` に設定すると `cdk synth` 時にエラーとなる。

### ルーティング（認証あり / なし の分離）

```typescript
const lambdaIntegration = new HttpLambdaIntegration('LambdaIntegration', this.apiHandler);
const jwtAuthorizer = new HttpUserPoolAuthorizer('JwtAuthorizer', this.userPool, {
  userPoolClients: [this.userPoolClient],
});

// GET /health: 認証不要（疎通確認・監視用）
this.httpApi.addRoutes({
  path: '/health',
  methods: [apigatewayv2.HttpMethod.GET],
  integration: lambdaIntegration,
});

// /{proxy+}: 全パスを Lambda にプロキシ（JWT 認証必須）
this.httpApi.addRoutes({
  path: '/{proxy+}',
  methods: [apigatewayv2.HttpMethod.ANY],
  integration: lambdaIntegration,
  authorizer: jwtAuthorizer,
});
```

## DynamoDB テーブルへのアクセス権限

```typescript
this.recipesTable.grantReadWriteData(this.apiHandler);
this.recipeIngredientsTable.grantReadWriteData(this.apiHandler);
this.menusTable.grantReadWriteData(this.apiHandler);
```

## デプロイワークフロー

1. Lambda コードの変更
2. `cdk deploy`（NodejsFunction が自動でビルド・バンドルする）

```bash
cd infra

# 差分確認
npx cdk diff --context stage=prod --context allowedOrigins=https://xxx.cloudfront.net

# デプロイ
npx cdk deploy --context stage=prod --context allowedOrigins=https://xxx.cloudfront.net
```

デプロイ完了後、CloudFormation Outputs に以下が出力される:

| Output キー        | 説明                                      |
| ------------------ | ----------------------------------------- |
| `HttpApiUrl`       | API Gateway HTTP API エンドポイント URL   |
| `UserPoolId`       | Cognito User Pool ID                      |
| `UserPoolClientId` | Cognito App Client ID                     |

---

## （参考）ビルド済みコードを使用する方法

`NodejsFunction` を使わず事前ビルドしたコードをデプロイする場合のみ参考にしてください。通常は不要。

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

const apiHandler = new lambda.Function(this, 'ApiHandler', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/dist')),
  environment: {
    RECIPES_TABLE_NAME: recipesTable.tableName,
    RECIPE_INGREDIENTS_TABLE_NAME: recipeIngredientsTable.tableName,
    MENUS_TABLE_NAME: menusTable.tableName,
  },
});
```

この場合、デプロイ前に `npm run lambda:build` を実行してください。

