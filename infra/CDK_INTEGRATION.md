# CDK から Lambda をデプロイする方法

## 概要

`infra/lambda/dist/` にビルドされた Lambda コードを CDK からデプロイする方法を説明します。

## 前提条件

Lambda コードをビルドしておく:

```bash
npm run lambda:build
```

## CDK での参照方法

### 方法1: NodejsFunction を使用 (推奨)

AWS CDK の `@aws-cdk/aws-lambda-nodejs` を使用すると、TypeScript コードを自動でビルドできます:

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

const apiHandler = new NodejsFunction(this, 'CookingPlannerApi', {
  entry: path.join(__dirname, '../lambda/src/index.ts'),
  handler: 'handler',
  runtime: lambda.Runtime.NODEJS_20_X,
  environment: {
    RECIPES_TABLE_NAME: recipesTable.tableName,
    RECIPE_INGREDIENTS_TABLE_NAME: ingredientsTable.tableName,
    MENUS_TABLE_NAME: menusTable.tableName,
    PANTRY_ITEMS_TABLE_NAME: pantryTable.tableName,
  },
});
```

### 方法2: ビルド済みコードを使用

事前にビルドしたコードを使用する場合:

```typescript
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';

const apiHandler = new lambda.Function(this, 'CookingPlannerApi', {
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/dist')),
  environment: {
    RECIPES_TABLE_NAME: recipesTable.tableName,
    RECIPE_INGREDIENTS_TABLE_NAME: ingredientsTable.tableName,
    MENUS_TABLE_NAME: menusTable.tableName,
    PANTRY_ITEMS_TABLE_NAME: pantryTable.tableName,
  },
});
```

この場合、デプロイ前に必ず `npm run lambda:build` を実行してください。

## API Gateway との統合

```typescript
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';

const httpApi = new apigatewayv2.HttpApi(this, 'CookingPlannerHttpApi', {
  apiName: 'cooking-planner-api',
  corsPreflight: {
    allowOrigins: ['*'], // 本番環境では適切に設定
    allowMethods: [
      apigatewayv2.CorsHttpMethod.GET,
      apigatewayv2.CorsHttpMethod.POST,
      apigatewayv2.CorsHttpMethod.PUT,
      apigatewayv2.CorsHttpMethod.DELETE,
    ],
    allowHeaders: ['Content-Type', 'Authorization'],
  },
});

const integration = new HttpLambdaIntegration(
  'LambdaIntegration',
  apiHandler
);

httpApi.addRoutes({
  path: '/{proxy+}',
  methods: [apigatewayv2.HttpMethod.ANY],
  integration,
});
```

## DynamoDB テーブルへのアクセス権限

Lambda に DynamoDB へのアクセス権限を付与:

```typescript
recipesTable.grantReadWriteData(apiHandler);
ingredientsTable.grantReadWriteData(apiHandler);
menusTable.grantReadWriteData(apiHandler);
```

## デプロイワークフロー

1. Lambda コードの変更
2. ビルド: `npm run lambda:build`
3. CDK デプロイ: `cdk deploy`

または、CDK で `NodejsFunction` を使う場合は、CDK が自動でビルドするため、手動ビルドは不要です。
