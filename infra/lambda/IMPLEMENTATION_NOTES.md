# Lambda 実装ノート

## Recipes API

### GET /recipes 実装

#### 概要
`docs/04-api-design.md` で規定された `GET /recipes` エンドポイントを処理します。

#### 実装詳細

**作成したファイル**
- `infra/lambda/src/recipes/getRecipes.ts` - GET /recipes のメインハンドラー
- `infra/lambda/src/recipes/index.ts` - recipes ハンドラーのエクスポートモジュール

**変更したファイル**
- `infra/lambda/src/index.ts` - GET /recipes エンドポイントのルーティングを追加

#### 動作仕様

1. **認証**: Cognito の JWT 認証を処理するため `APIGatewayProxyEventV2WithJWTAuthorizer` 型を使用
2. **ユーザー識別**: `event.requestContext.authorizer.jwt.claims.sub` から `userId` を抽出
3. **データ取得**: `userId` をパーティションキーとして DynamoDB `Recipes` テーブルをクエリ
4. **レスポンス整形**: DynamoDB のアイテムを API 仕様のフォーマットにマッピング
5. **エラー処理**: 適切な HTTP ステータスコードとエラーメッセージを返却

#### レスポンスフォーマット

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

#### セキュリティ機能

- **プライバシー保護**: ユーザー ID はログ内で切り詰められます（最初の 12 文字のみ）
- **Nullish Coalescing**: falsy な値を適切に処理するため `??` 演算子を使用
- **ユーザー分離**: クエリは認証済みユーザーのデータのみにスコープされます

---

## Menus API

### GET /menus, POST /menus, PUT /menus/{menuId}, DELETE /menus/{menuId} 実装

#### 概要
`docs/04-api-design.md` で規定された Menus API の全エンドポイントを処理します。

#### 実装詳細

**作成したファイル**
- `infra/lambda/src/menus/getMenus.ts` - GET /menus のメインハンドラー
- `infra/lambda/src/menus/createMenu.ts` - POST /menus のメインハンドラー
- `infra/lambda/src/menus/updateMenu.ts` - PUT /menus/{menuId} のメインハンドラー
- `infra/lambda/src/menus/deleteMenu.ts` - DELETE /menus/{menuId} のメインハンドラー
- `infra/lambda/src/menus/utils.ts` - `findMenuByMenuId` などの共通ユーティリティ
- `infra/lambda/src/menus/index.ts` - menus ハンドラーのエクスポートモジュール

**変更したファイル**
- `infra/lambda/src/index.ts` - Menus API エンドポイントのルーティングを追加
- `infra/lambda/src/shared/types.ts` - `Menu` 型を追加

#### DynamoDB テーブル設計

**テーブル名**: `Menus`

| キー | 値 | 説明 |
|---|---|---|
| PK (`userId`) | Cognito の `sub` クレーム | ユーザーを識別するパーティションキー |
| SK | `{date}#{mealType}#{menuId}` | 日付・食事区分・IDで構成されるソートキー |

SK のフォーマットにより、`BETWEEN` を使った日付範囲クエリが効率的に行えます。

#### GET /menus の動作仕様

1. `from` / `to` クエリパラメータを検証（未指定時は今日から 7 日分を自動設定）
2. DynamoDB の `BETWEEN` クエリで `{from}#` 〜 `{to}#\uffff` の範囲を取得
3. ページネーション対応（`ExclusiveStartKey` を使ったループ処理）
4. 取得したアイテムをレスポンス形式にマッピングして返却

#### POST /menus の動作仕様

1. リクエストボディを JSON パースしてバリデーション
2. `mealType` は `BREAKFAST` / `LUNCH` / `DINNER` / `OTHER` のいずれかに制限
3. `menuId` は `randomUUID()` で生成
4. SK を `{date}#{mealType}#{menuId}` 形式で構築して DynamoDB に Put

#### PUT /menus/{menuId} の動作仕様

1. `findMenuByMenuId` で既存アイテムを検索（存在しない場合は 404）
2. リクエストボディをバリデーション
3. `date` または `mealType` が変更された場合は SK も変わるため、  
   旧アイテムの削除と新アイテムの作成を `TransactWriteCommand` で原子的に実行
4. SK が変わらない場合は通常の `PutCommand` で上書き

#### DELETE /menus/{menuId} の動作仕様

1. `findMenuByMenuId` で既存アイテムを検索（存在しない場合は 404）
2. `DeleteCommand` で DynamoDB からアイテムを削除
3. 204 No Content を返却

#### エラーコード一覧

| コード | HTTP | 説明 |
|---|---|---|
| `UNAUTHORIZED` | 401 | JWT に `sub` クレームが存在しない |
| `BAD_REQUEST` | 400 | バリデーションエラー（日付形式・mealType・必須フィールドなど） |
| `MENU_NOT_FOUND` | 404 | 指定された `menuId` の献立が存在しない |
| `RESOURCE_NOT_FOUND` | 500 | DynamoDB の `Menus` テーブルが存在しない |
| `ACCESS_DENIED` | 500 | DynamoDB へのアクセスが拒否された |
| `INTERNAL_SERVER_ERROR` | 500 | 予期せぬエラー |

#### テスト方法

デプロイ後にこれらのエンドポイントをテストするには：

**前提条件**
- DynamoDB `Menus` テーブルが PK=`userId`、SK=`{date}#{mealType}#{menuId}` で作成されていること
- JWT Authorizer が設定された API Gateway
- ユーザーが登録された Cognito User Pool

**テストリクエスト例**

```bash
# 献立一覧取得
curl -H "Authorization: Bearer <JWT_TOKEN>" \
     "https://your-api-domain/menus?from=2025-11-21&to=2025-11-27"

# 献立登録
curl -X POST \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"date":"2025-11-21","mealType":"DINNER","recipeId":"<recipeId>","servings":2}' \
     https://your-api-domain/menus

# 献立更新
curl -X PUT \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     -H "Content-Type: application/json" \
     -d '{"date":"2025-11-21","mealType":"DINNER","recipeId":"<recipeId>","servings":3}' \
     https://your-api-domain/menus/<menuId>

# 献立削除
curl -X DELETE \
     -H "Authorization: Bearer <JWT_TOKEN>" \
     https://your-api-domain/menus/<menuId>
```

#### 必要な環境変数

Lambda 関数には以下の環境変数が必要です（CDK 経由で設定）：
- Recipes API（GET /recipes）
  - `RECIPES_TABLE_NAME`: DynamoDB Recipes テーブルの名前
- Menus API（GET / POST / PUT / DELETE）
  - `MENUS_TABLE_NAME`: DynamoDB Menus テーブルの名前
