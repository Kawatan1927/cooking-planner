# 04. API Design

このドキュメントでは、フロントエンド（SPA）から呼び出す  
**HTTP API の設計**を定義する。

バックエンド構成は以下の通り：

- API Gateway (HTTP API)
- Lambda (Node.js + TypeScript)
- DynamoDB

認証は Amazon Cognito による JWT（IDトークン or Accessトークン）で行い、  
API Gateway で JWT Authorizer を用いて検証する。

---

## 1. 共通仕様

### 1.1 ベースURL

- `https://<cloudfront-domain>/api` を想定
  - CloudFront → API Gateway へのパスベースルーティングで `/api` をバックエンドに転送
  - または、フロントと API を別ドメインにしても良い
- フロントエンドからは `.env` などで `VITE_API_BASE_URL` として指定する。

### 1.2 HTTP ヘッダ

- リクエスト
  - `Content-Type: application/json`（ボディがある場合）
  - `Authorization: Bearer <JWT>`（ログイン済みの場合・全エンドポイント必須）

- レスポンス
  - `Content-Type: application/json; charset=utf-8`

### 1.3 認証

- 認証方式：**Bearer Token (JWT)**

  - Amazon Cognito User Pool による認証
  - フロントは Cognito Hosted UI or SDK経由でログインし、  
    IDトークン or Accessトークンを取得する

- API Gateway 側設定：
  - JWT Authorizer を利用し、User Pool を紐付ける
  - すべての業務エンドポイントは **認証必須**

- Lambda 側：
  - `event.requestContext.authorizer.jwt.claims` から `sub` or email などを取得し、`userId` として利用する

### 1.4 日付・時刻の扱い

- 日付文字列：`YYYY-MM-DD`（例：`2025-11-21`）
- 日時文字列（ISO8601）：
  - `2025-11-21T12:34:56.789Z`
- タイムゾーン：
  - DynamoDB に保存する日時は UTC を基本とする（`Z`）

### 1.5 エラーレスポンス形式

基本形は以下の通り：

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Recipe not found",
    "details": null
  }
}

代表的なステータスコード：

* `400 Bad Request`

    * バリデーションエラーなど
* `401 Unauthorized`

    * JWT 不正・欠如（API Gateway側で弾かれる場合もある）
* `403 Forbidden`

    * 認証は通っているが、対象リソースの `userId` が異なるなど
* `404 Not Found`

    * 該当リソースが存在しない
* `500 Internal Server Error`

    * 予期せぬ例外

※ 最初は雑でもよくて、必要に応じて `code` を増やす。

---

## 2. Recipes API

### 2.1 GET /recipes

**概要**

* ログインユーザーの全レシピ一覧を取得する。
* 初期段階ではページングなしで全件返す（件数が増えたら対応検討）。

**Request**

* Method: `GET`
* Path: `/recipes`
* Query Parameters: なし（将来的にキーワード検索等の追加はあり）

**Response 200**

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

---

### 2.2 POST /recipes

**概要**

* 新しいレシピを登録する。
* 材料も一緒に登録する。

**Request**

* Method: `POST`
* Path: `/recipes`

**Request Body**

```json
{
  "name": "鶏の照り焼き",
  "sourceBook": "週末の定番おかず",
  "sourcePage": 34,
  "baseServings": 2,
  "memo": "少し甘めなので砂糖控えめが好み",
  "ingredients": [
    {
      "ingredientName": "鶏もも肉",
      "quantity": 300,
      "unit": "g",
      "note": null
    },
    {
      "ingredientName": "しょうゆ",
      "quantity": 2,
      "unit": "大さじ",
      "note": null
    }
  ]
}
```

**Response 201**

```json
{
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11"
}
```

※ 必要に応じて作成したレシピ全体を返してもよい。

---

### 2.3 GET /recipes/{recipeId}

**概要**

* 特定のレシピの詳細情報を取得する。
* レシピ本体＋材料一覧を含めて返す。

**Request**

* Method: `GET`
* Path: `/recipes/{recipeId}`

**Response 200**

```json
{
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "name": "鶏の照り焼き",
  "sourceBook": "週末の定番おかず",
  "sourcePage": 34,
  "baseServings": 2,
  "memo": "少し甘めなので砂糖控えめが好み",
  "createdAt": "2025-11-21T12:00:00.000Z",
  "updatedAt": "2025-11-21T12:00:00.000Z",
  "ingredients": [
    {
      "ingredientName": "鶏もも肉",
      "quantity": 300,
      "unit": "g",
      "note": null
    },
    {
      "ingredientName": "しょうゆ",
      "quantity": 2,
      "unit": "大さじ",
      "note": null
    }
  ]
}
```

**Response 404**

```json
{
  "error": {
    "code": "RECIPE_NOT_FOUND",
    "message": "Recipe not found",
    "details": null
  }
}
```

---

### 2.4 PUT /recipes/{recipeId}

**概要**

* 既存レシピの情報を更新する。
* 材料リストも含めて全体更新（差分更新ではなく置き換え）とする。

**Request**

* Method: `PUT`
* Path: `/recipes/{recipeId}`

**Request Body**

POST `/recipes` と同じ構造：

```json
{
  "name": "鶏の照り焼き（甘さ控えめ）",
  "sourceBook": "週末の定番おかず",
  "sourcePage": 34,
  "baseServings": 2,
  "memo": "砂糖を小さじ1/2減らした",
  "ingredients": [
    {
      "ingredientName": "鶏もも肉",
      "quantity": 320,
      "unit": "g",
      "note": null
    }
  ]
}
```

**Response 200**

```json
{
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11"
}
```

---

## 3. Menus API（献立）

### 3.1 GET /menus

**概要**

* 指定期間内の献立を取得する。
* 初期は簡易に `from` / `to` を指定し、返り値は「日付＋食事区分ごとの配列」とする。

**Request**

* Method: `GET`
* Path: `/menus`
* Query Parameters:

    * `from` (optional, `YYYY-MM-DD`)
    * `to` (optional, `YYYY-MM-DD`)

`from` / `to` 未指定時の挙動：

* 未指定の場合は「今日から7日分」など適当なデフォルトを決める。

**Response 200**

```json
{
  "from": "2025-11-21",
  "to": "2025-11-23",
  "items": [
    {
      "date": "2025-11-21",
      "mealType": "DINNER",
      "menuId": "5b5af0bb-3c10-45e7-8f5e-6f541b2da111",
      "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
      "servings": 1
    },
    {
      "date": "2025-11-22",
      "mealType": "DINNER",
      "menuId": "d8aa570f-b827-4f08-8a40-e9ac7644a911",
      "recipeId": "9f365a0e-57bc-4fa5-9664-a66a8d6736d9",
      "servings": 2
    }
  ]
}
```

---

### 3.2 POST /menus

**概要**

* ある日付・食事区分に、レシピを紐付ける献立を登録する。
* 同じ日付・食事区分に複数レシピを登録可能。

**Request**

* Method: `POST`
* Path: `/menus`

**Request Body**

```json
{
  "date": "2025-11-21",
  "mealType": "DINNER",
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "servings": 1,
  "memo": null
}
```

**Response 201**

```json
{
  "menuId": "5b5af0bb-3c10-45e7-8f5e-6f541b2da111"
}
```

---

### 3.3 PUT /menus/{menuId}

**概要**

* 既存の献立（1件）を更新する。
* 主に `servings` や `recipeId` の変更。

**Request**

* Method: `PUT`
* Path: `/menus/{menuId}`

**Request Body**

```json
{
  "date": "2025-11-21",
  "mealType": "DINNER",
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "servings": 2,
  "memo": "友達が一人来る"
}
```

**Response 200**

```json
{
  "menuId": "5b5af0bb-3c10-45e7-8f5e-6f541b2da111"
}
```

---

### 3.4 DELETE /menus/{menuId}

**概要**

* 献立から1件のレシピを削除する。

**Request**

* Method: `DELETE`
* Path: `/menus/{menuId}`

**Response 204**

* ボディなし。

---

## 4. Shopping List API（買い物リスト）

### 4.1 GET /shopping-list

**概要**

* 指定期間の献立から、必要な材料の合計量を計算して返す。

**Request**

* Method: `GET`
* Path: `/shopping-list`
* Query Parameters:

    * `from` (required) `YYYY-MM-DD`
    * `to` (required) `YYYY-MM-DD`

**Response 200**

```json
{
  "from": "2025-11-21",
  "to": "2025-11-23",
  "items": [
    {
      "ingredientName": "玉ねぎ",
      "totalQuantity": 1.5,
      "unit": "個"
    },
    {
      "ingredientName": "鶏もも肉",
      "totalQuantity": 400,
      "unit": "g"
    }
  ]
}
```

**処理概要（Lambda側）**

1. `Menus` から `from`〜`to` の献立を取得
2. 各 `menuItem` について：

    * `Recipes` から `baseServings` を取得
    * `RecipeIngredients` から材料一覧を取得
    * `servings / baseServings` で分量をスケーリング
3. `ingredientName + unit` 単位で合計値を集計
4. 上記形式でレスポンスに整形

---

## 5. Health Check API（任意）

### 5.1 GET /health

**概要**

* デバッグ・疎通確認用の簡易エンドポイント。
* 認証不要 or 認証必須のどちらでもよい（個人用なので好み）。

**Request**

* Method: `GET`
* Path: `/health`

**Response 200**

```json
{
  "status": "ok",
  "time": "2025-11-21T12:34:56.789Z"
}
```

---

## 6. 今後の拡張余地（メモ）

* `Recipes` 一覧にページング・ソートを追加
* フリーテキスト検索（名前・出典本など）
* `Menus` の取得形式を「日付ごとにネストした形」に変える or オプション化
* `PantryItems` に関連するAPIの追加（常備品管理）
* バリデーションエラー時の詳細な `details` 構造の設計

