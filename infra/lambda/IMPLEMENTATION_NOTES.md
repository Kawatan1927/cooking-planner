# GET /recipes 実装

## 概要
この実装は `docs/04-api-design.md` で規定された `GET /recipes` エンドポイントを処理します。

## 実装詳細

### 作成したファイル
- `infra/lambda/src/recipes/getRecipes.ts` - GET /recipes のメインハンドラー
- `infra/lambda/src/recipes/index.ts` - recipes ハンドラーのエクスポートモジュール

### 変更したファイル
- `infra/lambda/src/index.ts` - GET /recipes エンドポイントのルーティングを追加

## 動作仕様

1. **認証**: Cognito の JWT 認証を処理するため `APIGatewayProxyEventV2WithJWTAuthorizer` 型を使用
2. **ユーザー識別**: `event.requestContext.authorizer.jwt.claims.sub` から `userId` を抽出
3. **データ取得**: `userId` をパーティションキーとして DynamoDB `Recipes` テーブルをクエリ
4. **レスポンス整形**: DynamoDB のアイテムを API 仕様のフォーマットにマッピング
5. **エラー処理**: 適切な HTTP ステータスコードとエラーメッセージを返却

## レスポンスフォーマット

成功時 (200):
```json
[
  {
    "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
    "name": "鶏の照り焼き",
    "sourceBook": "週末の定番おかず",
    "sourcePage": 34,
    "baseServings": 2,
    "createdAt": "2025-11-21T12:00:00.000Z",
    "updatedAt": "2025-11-21T12:00:00.000Z"
  }
]
```

エラーレスポンスは `docs/04-api-design.md` で規定されたフォーマットに従います：
- 401: Unauthorized (JWT が無効または欠如)
- 500: Internal Server Error

## セキュリティ機能

- **プライバシー保護**: ユーザー ID はログ内で切り詰められます（最初の 8 文字のみ）
- **Nullish Coalescing**: falsy な値を適切に処理するため `??` 演算子を使用
- **ユーザー分離**: クエリは認証済みユーザーのデータのみにスコープされます

## テスト方法

デプロイ後にこのエンドポイントをテストするには：

1. **前提条件**:
   - DynamoDB `Recipes` テーブルが PK=userId, SK=recipeId で作成されていること
   - JWT Authorizer が設定された API Gateway
   - ユーザーが登録された Cognito User Pool

2. **テストリクエスト**:
```bash
curl -H "Authorization: Bearer <JWT_TOKEN>" \
     https://your-api-domain/recipes
```

3. **期待される動作**:
   - ユーザーにレシピが存在しない場合: 空の配列 `[]` を返す
   - レシピが存在する場合: レシピオブジェクトの配列を返す
   - JWT が無効な場合: 401 エラーを返す

## 必要な環境変数

Lambda 関数には以下の環境変数が必要です（CDK 経由で設定）：
- `RECIPES_TABLE_NAME`: DynamoDB Recipes テーブルの名前

## 今後の実装予定

実装予定の将来のエンドポイント：
- POST /recipes - 新しいレシピを作成
- GET /recipes/{recipeId} - レシピ詳細を取得
- PUT /recipes/{recipeId} - レシピを更新
- DELETE /recipes/{recipeId} - レシピを削除
