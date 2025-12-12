# DynamoDB テーブル設定

このドキュメントでは、Cooking Planner アプリケーションで使用する DynamoDB テーブルの CDK 設定を記載します。

## 概要

3つのテーブルを使用してアプリケーションデータを管理します：
- **Recipes**: レシピ情報
- **RecipeIngredients**: レシピに紐づく材料情報
- **Menus**: 献立情報

## 共通設定

すべてのテーブルに共通する設定：

| 設定項目 | 値 | 説明 |
|---------|-----|------|
| Billing Mode | PAY_PER_REQUEST | オンデマンド課金モデル（使用量に応じた課金） |
| Removal Policy (prod) | RETAIN | 本番環境ではスタック削除時もテーブルを保持 |
| Removal Policy (dev) | DESTROY | 開発環境ではスタック削除時にテーブルも削除 |
| Point-in-Time Recovery (prod) | 有効 | 本番環境では過去35日間のバックアップを保持 |
| Point-in-Time Recovery (dev) | 無効 | 開発環境ではコスト削減のため無効化 |

## Recipes テーブル

レシピ本体の情報を保持するテーブル。

### テーブル設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| テーブル名 | `CookingPlanner-Recipes-{stage}` | stage は `prod` または `dev` |
| Partition Key | `userId` (String) | ユーザーID |
| Sort Key | `recipeId` (String) | レシピID (UUID) |

### データ構造

```typescript
{
  userId: string;        // ユーザーID (Cognito sub または email)
  recipeId: string;      // レシピID (UUID)
  name: string;          // レシピ名
  sourceBook?: string;   // 出典本のタイトル
  sourcePage?: number;   // 出典本のページ番号
  baseServings: number;  // 基本人数
  memo?: string;         // メモ
  createdAt: string;     // 作成日時 (ISO8601)
  updatedAt: string;     // 更新日時 (ISO8601)
}
```

### アクセスパターン

- **レシピ一覧取得**: `Query` with `PK = userId`
- **レシピ詳細取得**: `GetItem` with `PK = userId, SK = recipeId`

### CDK コード参照

```typescript
const recipesTable = new dynamodb.Table(this, 'RecipesTable', {
  tableName: `CookingPlanner-Recipes-${stage}`,
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'recipeId', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  pointInTimeRecovery: stage === 'prod',
});
```

## RecipeIngredients テーブル

各レシピに紐づく材料情報を保持するテーブル。

### テーブル設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| テーブル名 | `CookingPlanner-RecipeIngredients-{stage}` | stage は `prod` または `dev` |
| Partition Key | `userId` (String) | ユーザーID |
| Sort Key | `SK` (String) | `recipeId#ingredientName` の形式 |

### データ構造

```typescript
{
  userId: string;           // ユーザーID
  SK: string;              // recipeId#ingredientName (例: "uuid-123#玉ねぎ")
  recipeId: string;        // レシピID
  ingredientName: string;  // 材料名
  quantity: number | string; // 分量
  unit: string;            // 単位 (g, ml, 個, 大さじ など)
  note?: string;           // 備考 (切り方など)
}
```

### アクセスパターン

- **特定レシピの材料一覧**: `Query` with `PK = userId AND begins_with(SK, "recipeId#")`

### CDK コード参照

```typescript
const recipeIngredientsTable = new dynamodb.Table(this, 'RecipeIngredientsTable', {
  tableName: `CookingPlanner-RecipeIngredients-${stage}`,
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  pointInTimeRecovery: stage === 'prod',
});
```

## Menus テーブル

日付・食事区分ごとの献立情報を保持するテーブル。

### テーブル設定

| 項目 | 値 | 説明 |
|-----|-----|------|
| テーブル名 | `CookingPlanner-Menus-{stage}` | stage は `prod` または `dev` |
| Partition Key | `userId` (String) | ユーザーID |
| Sort Key | `SK` (String) | `date#mealType#menuId` の形式 |

### データ構造

```typescript
{
  userId: string;              // ユーザーID
  SK: string;                 // date#mealType#menuId (例: "2025-12-12#DINNER#uuid-456")
  date: string;               // 日付 (YYYY-MM-DD)
  mealType: string;           // 食事区分 (BREAKFAST, LUNCH, DINNER, OTHER)
  menuId: string;             // 献立ID (UUID)
  recipeId: string;           // レシピID
  servings: number;           // 実際の人数
  memo?: string;              // メモ
  createdAt: string;          // 作成日時 (ISO8601)
  updatedAt: string;          // 更新日時 (ISO8601)
}
```

### アクセスパターン

- **特定期間の献立取得**: `Query` with `PK = userId` + FilterExpression で日付範囲を指定
- **特定日付の献立取得**: `Query` with `PK = userId AND begins_with(SK, "date#")`

### CDK コード参照

```typescript
const menusTable = new dynamodb.Table(this, 'MenusTable', {
  tableName: `CookingPlanner-Menus-${stage}`,
  partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
  sortKey: { name: 'SK', type: dynamodb.AttributeType.STRING },
  billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
  removalPolicy: stage === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  pointInTimeRecovery: stage === 'prod',
});
```

## 環境変数

Lambda 関数に以下の環境変数を設定してテーブル名を渡します：

```typescript
environment: {
  RECIPES_TABLE_NAME: recipesTable.tableName,
  RECIPE_INGREDIENTS_TABLE_NAME: recipeIngredientsTable.tableName,
  MENUS_TABLE_NAME: menusTable.tableName,
  // ...
}
```

## IAM 権限

Lambda 関数には各テーブルへの読み書き権限を付与：

```typescript
recipesTable.grantReadWriteData(apiLambda);
recipeIngredientsTable.grantReadWriteData(apiLambda);
menusTable.grantReadWriteData(apiLambda);
```

## 参考資料

- [データモデル詳細](/docs/03-domain-and-data-model.md)
- [AWS DynamoDB ドキュメント](https://docs.aws.amazon.com/dynamodb/)
