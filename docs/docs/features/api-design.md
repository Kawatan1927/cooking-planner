---
id: api-design
title: API 設計
sidebar_position: 3
---

このドキュメントでは、フロントエンド（SPA）から呼び出す HTTP API の設計を定義する。

バックエンド構成は Bun + Hono と PostgreSQL。第一候補の認証境界は Tailscale tailnet で、Hono は当面 `DEV_USER_ID=local-dev-user` を単一ユーザーの `userId` として扱う。Cloudflare Access は独自ドメインやインターネット公開が必要になった場合の代替案とする。

## 共通仕様

### ベース URL

- `https://<device>.<tailnet>.ts.net/api` を想定する。
  - Tailscale Serve からローカル PC 上の Hono server へ転送する。
  - フロントエンドと API は同一 Hono server で配信するため、同一ドメインになる。
- フロントエンドからは `.env` などで `VITE_API_BASE_URL` として指定する。

### HTTP ヘッダ

- リクエスト
  - `Content-Type: application/json`（ボディがある場合）
  - `Cf-Access-Jwt-Assertion`（Cloudflare Access 代替構成でオリジンへの転送時に付与）
- レスポンス
  - `Content-Type: application/json; charset=utf-8`

### 認証

- 第一候補の認証境界は Tailscale tailnet。
- tailnet に参加している端末からのリクエストのみ Hono server に到達する。
- フロントエンドは JWT を保持せず、API 呼び出し時に `Authorization` ヘッダを付与しない。
- Hono 側では当面 `DEV_USER_ID=local-dev-user` を固定し、単一ユーザーの `userId` として扱う。
- `DEV_USER_ID` を変えると DB 上の `user_id` スコープが変わり、既存データが見えなくなる。
- Cloudflare Access を代替案として使う場合は、`Cf-Access-Jwt-Assertion` を Cloudflare Access の公開鍵で検証し、JWT の `email`（なければ `sub`）を `userId` として扱う。
- すべての業務エンドポイントは認証必須。

### 日付・時刻

- 日付文字列: `YYYY-MM-DD`
- 日時文字列: ISO 8601（例: `2025-11-21T12:34:56.789Z`）
- PostgreSQL に保存する日時は UTC を基本とする。

### エラーレスポンス

基本形は以下の通り。

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Recipe not found",
    "details": null
  }
}
```

代表的なステータスコード:

- `400 Bad Request`: バリデーションエラーなど
- `401 Unauthorized`: 認証情報の不正・欠如、または userId を確定できない
- `403 Forbidden`: 認証は通っているが、対象リソースの `userId` が異なる
- `404 Not Found`: 該当リソースが存在しない
- `500 Internal Server Error`: 予期せぬ例外

最初は必要最小限の `code` で運用し、必要に応じて増やす。

## Recipes API

### `GET /recipes`

ログインユーザーの全レシピ一覧を取得する。初期段階ではページングなしで全件返す。件数が増えたらページングを検討する。

**Request**

- Method: `GET`
- Path: `/recipes`
- Query Parameters: なし（将来的にキーワード検索等を追加してもよい）

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

### `POST /recipes`

新しいレシピを登録する。材料も一緒に登録する。

**Request**

- Method: `POST`
- Path: `/recipes`

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

`quantity` は正の数値（`number`）または空でない文字列（`string`）を受け付ける。数値で表せない分量（例: 「適量」）は文字列として指定する。

**Response 201**

```json
{
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11"
}
```

必要に応じて、作成したレシピ全体を返してもよい。

### `GET /recipes/{recipeId}`

特定のレシピの詳細情報を取得する。レシピ本体と材料一覧を含めて返す。

**Request**

- Method: `GET`
- Path: `/recipes/{recipeId}`

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

### `PUT /recipes/{recipeId}`

既存レシピの情報を更新する。材料リストも含めて全体更新とし、差分更新ではなく置き換えとする。

**Request**

- Method: `PUT`
- Path: `/recipes/{recipeId}`

**Request Body**

POST `/recipes` と同じ構造。

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

**Response 400**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Recipe name is required",
    "details": null
  }
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

## Menus API

### `GET /menus`

指定期間内の献立を取得する。初期は簡易に `from` / `to` を指定し、返り値は日付＋食事区分ごとの配列とする。

**Request**

- Method: `GET`
- Path: `/menus`
- Query Parameters:
  - `from` (optional, `YYYY-MM-DD`)
  - `to` (optional, `YYYY-MM-DD`)

`from` / `to` 未指定の場合は「今日から7日分」（今日〜6日後）をデフォルトとする。

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

**Response 400**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid \"from\" date format. Use YYYY-MM-DD",
    "details": null
  }
}
```

バリデーションエラーになるケース:

- `from` / `to` が `YYYY-MM-DD` 形式でない。
- `from` が `to` より後の日付。

### `POST /menus`

ある日付・食事区分に、レシピを紐付ける献立を登録する。同じ日付・食事区分に複数レシピを登録可能。

**Request**

- Method: `POST`
- Path: `/menus`

**Request Body**

| フィールド | 型                      | 必須 | 説明                                                  |
| ---------- | ----------------------- | ---- | ----------------------------------------------------- |
| `date`     | `string` (`YYYY-MM-DD`) | yes  | 献立の日付                                            |
| `mealType` | `string`                | yes  | `BREAKFAST` / `LUNCH` / `DINNER` / `OTHER` のいずれか |
| `recipeId` | `string`                | yes  | 紐付けるレシピの ID                                   |
| `servings` | `number`                | yes  | 人数（正の数値）                                      |
| `memo`     | `string` \| `null`      | no   | メモ（任意）                                          |

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

**Response 400**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid \"mealType\". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER",
    "details": null
  }
}
```

バリデーションエラーになる代表的なケース:

- リクエストボディが存在しない。
- リクエストボディが JSON として不正。
- `date` が `YYYY-MM-DD` 形式でない。
- `mealType` が有効値以外。
- `recipeId` が空または文字列でない。
- `servings` が正の数値でない。

### `PUT /menus/{menuId}`

既存の献立（1件）を更新する。主に `servings` や `recipeId` の変更に使う。

**Request**

- Method: `PUT`
- Path: `/menus/{menuId}`

**Request Body**

POST `/menus` と同じ構造。

```json
{
  "date": "2025-11-21",
  "mealType": "DINNER",
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "servings": 2,
  "memo": "友達が一人来る"
}
```

`date` または `mealType` を変更した場合も、PostgreSQL トランザクション内で旧レコードの更新を実行する。

**Response 200**

```json
{
  "menuId": "5b5af0bb-3c10-45e7-8f5e-6f541b2da111"
}
```

**Response 400**

```json
{
  "error": {
    "code": "BAD_REQUEST",
    "message": "Invalid \"mealType\". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER",
    "details": null
  }
}
```

**Response 404**

```json
{
  "error": {
    "code": "MENU_NOT_FOUND",
    "message": "Menu not found",
    "details": null
  }
}
```

### `DELETE /menus/{menuId}`

献立から1件のレシピを削除する。

**Request**

- Method: `DELETE`
- Path: `/menus/{menuId}`

**Response 204**

ボディなし。

**Response 404**

```json
{
  "error": {
    "code": "MENU_NOT_FOUND",
    "message": "Menu not found",
    "details": null
  }
}
```

## Shopping List API

### `GET /shopping-list`

指定期間の献立から、必要な材料の合計量を計算して返す。

**Request**

- Method: `GET`
- Path: `/shopping-list`
- Query Parameters:
  - `from` (required, `YYYY-MM-DD`)
  - `to` (required, `YYYY-MM-DD`)

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

`RecipeIngredients.quantity` は数値だけでなく、`"少々"` のような文字列も許容する。`GET /shopping-list` では材料ごと（`ingredientName + unit`）に集計するが、文字列 quantity は人数比でスケーリングできないためスケーリングせず、同一キー内では `+` で連結して返す。数値と文字列が混在する場合は `"<数値> + <文字列>"` のような文字列として `totalQuantity` を返す。

**処理概要**

1. `menus` テーブルから `from`〜`to` の献立を取得する。
2. 各 `menu_item` について `recipes` から `base_servings` を取得する。
3. `recipe_ingredients` から材料一覧を取得する。
4. `servings / base_servings` で分量をスケーリングする。
5. `ingredient_name + unit` 単位で合計値を集計する。
6. レスポンス形式へ整形する。

## Health Check API

### `GET /health`

デバッグ・疎通確認用の簡易エンドポイント。認証不要か認証必須かは、個人用のため運用に合わせて決める。

**Request**

- Method: `GET`
- Path: `/health`

**Response 200**

```json
{
  "status": "ok",
  "time": "2025-11-21T12:34:56.789Z"
}
```

## 今後の拡張余地

- `Recipes` 一覧にページング・ソートを追加する。
- フリーテキスト検索（名前・出典本など）を追加する。
- `Menus` の取得形式を日付ごとにネストした形に変える、またはオプション化する。
- `PantryItems` に関連する API を追加する。
- バリデーションエラー時の詳細な `details` 構造を設計する。
