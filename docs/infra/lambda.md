# Lambda 関数設定

このドキュメントでは、Cooking Planner アプリケーションの API バックエンドを実装する Lambda 関数の CDK 設定を記載します。

## 概要

単一の Lambda 関数で全 API エンドポイントを処理する「小さめモノリス」構成を採用しています。

## 基本設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| 関数名 | `CookingPlanner-Api-{stage}` | stage は `prod` または `dev` |
| Runtime | Node.js 20.x | 最新の LTS バージョン |
| Handler | `index.handler` | エントリーポイント |
| Timeout | 30秒 | API リクエストの最大処理時間 |

## 環境変数

Lambda 関数には以下の環境変数を設定しています：

| 環境変数名 | 説明 | 例 |
|-----------|------|-----|
| `RECIPES_TABLE_NAME` | Recipes テーブル名 | `CookingPlanner-Recipes-prod` |
| `RECIPE_INGREDIENTS_TABLE_NAME` | RecipeIngredients テーブル名 | `CookingPlanner-RecipeIngredients-prod` |
| `MENUS_TABLE_NAME` | Menus テーブル名 | `CookingPlanner-Menus-prod` |
| `NODE_ENV` | 実行環境 | `prod` または `dev` |

## IAM ロールと権限

### DynamoDB アクセス権限

以下のテーブルに対して読み書き権限を付与：
- Recipes テーブル
- RecipeIngredients テーブル
- Menus テーブル

CDK により自動的に以下のアクションが許可されます：
- `dynamodb:GetItem`
- `dynamodb:PutItem`
- `dynamodb:UpdateItem`
- `dynamodb:DeleteItem`
- `dynamodb:Query`
- `dynamodb:Scan`
- `dynamodb:BatchGetItem`
- `dynamodb:BatchWriteItem`

### CloudWatch Logs 権限

Lambda サービスロールに自動的に CloudWatch Logs への書き込み権限が付与されます。

## 現在の実装状態

### プレースホルダー実装

初期状態では、以下のプレースホルダーコードが設定されています：

```javascript
exports.handler = async (event) => {
  console.log('Event:', JSON.stringify(event, null, 2));
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
    body: JSON.stringify({ 
      message: 'API Lambda placeholder - implementation pending' 
    }),
  };
};
```

### 今後の実装予定

実際の API 実装は `lambda/` ディレクトリに以下の構成で作成予定：

```
lambda/
├── handler.ts               # メインエントリーポイント
├── recipes/                 # レシピ関連の処理
│   ├── list.ts
│   ├── get.ts
│   ├── create.ts
│   ├── update.ts
│   └── delete.ts
├── menus/                   # 献立関連の処理
│   └── ...
├── shoppingList/            # 買い物リスト関連の処理
│   └── ...
└── shared/                  # 共通処理
    ├── dynamodb.ts          # DynamoDB クライアント
    ├── auth.ts              # 認証処理
    └── types.ts             # 型定義
```

## CDK コード参照

### Lambda 関数の定義

```typescript
const apiLambda = new lambda.Function(this, 'ApiLambda', {
  functionName: `CookingPlanner-Api-${stage}`,
  runtime: lambda.Runtime.NODEJS_20_X,
  handler: 'index.handler',
  code: lambda.Code.fromInline(`
    exports.handler = async (event) => {
      console.log('Event:', JSON.stringify(event, null, 2));
      return {
        statusCode: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
        body: JSON.stringify({ message: 'API Lambda placeholder - implementation pending' }),
      };
    };
  `),
  environment: {
    RECIPES_TABLE_NAME: recipesTable.tableName,
    RECIPE_INGREDIENTS_TABLE_NAME: recipeIngredientsTable.tableName,
    MENUS_TABLE_NAME: menusTable.tableName,
    NODE_ENV: stage,
  },
  timeout: cdk.Duration.seconds(30),
});
```

### 権限の付与

```typescript
recipesTable.grantReadWriteData(apiLambda);
recipeIngredientsTable.grantReadWriteData(apiLambda);
menusTable.grantReadWriteData(apiLambda);
```

## ロギング

### CloudWatch Logs

Lambda 関数の実行ログは自動的に CloudWatch Logs に送信されます。

ロググループ名: `/aws/lambda/CookingPlanner-Api-{stage}`

### ログ保持期間

デフォルトでは無期限ですが、必要に応じて CDK で設定可能：

```typescript
// 例: 1週間の保持期間を設定する場合
import * as logs from 'aws-cdk-lib/aws-logs';

const apiLambda = new lambda.Function(this, 'ApiLambda', {
  // ... 他の設定
  logRetention: logs.RetentionDays.ONE_WEEK,
});
```

## モニタリング

Lambda 関数の以下のメトリクスが CloudWatch で自動的に収集されます：

- **Invocations**: 実行回数
- **Errors**: エラー発生回数
- **Duration**: 実行時間
- **Throttles**: スロットリング回数
- **ConcurrentExecutions**: 同時実行数

## コールドスタート対策

現在の設定では特別な対策は行っていませんが、必要に応じて以下を検討可能：

1. **プロビジョンド同時実行数**: 常に温かい状態の Lambda を確保
2. **Lambda レイヤー**: 共通ライブラリを分離して起動時間を短縮
3. **Snapstart**: Java ランタイム用の高速起動機能（Node.js では未対応）

## セキュリティ

### 認証

API Gateway 経由でのみアクセス可能。
Cognito JWT トークンによる認証は API Gateway レベルで実装予定。

### 環境変数の暗号化

機密情報を環境変数に含める場合は、AWS Secrets Manager または SSM Parameter Store の使用を推奨。

## 参考資料

- [API 設計](/docs/04-api-design.md)
- [アーキテクチャ構成](/docs/05-architecture-notes.md)
- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/)
