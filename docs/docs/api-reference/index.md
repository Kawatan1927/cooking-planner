---
id: api-reference-index
title: API リファレンス
sidebar_position: 1
---

# API リファレンス

Cooking Planner バックエンドが提供する REST API の概要をまとめます。  
インタラクティブな試用は **[Swagger UI](/api-reference/swagger-ui)** ページから行えます。

> 詳細な設計意図・背景は [`docs/04-api-design.md`](https://github.com/Kawatan1927/cooking-planner/blob/main/docs/04-api-design.md) を参照してください。  
> OpenAPI 仕様ファイル: [`static/api/cooking-planner.yaml`](https://github.com/Kawatan1927/cooking-planner/blob/main/docs/static/api/cooking-planner.yaml)

---

## 共通仕様

### ベース URL

```
https://<cloudfront-domain>/api
```

CloudFront → API Gateway へのパスベースルーティングで `/api` をバックエンドに転送します。  
フロントエンドからは `VITE_API_BASE_URL` 環境変数で指定します。

### HTTP ヘッダ

| ヘッダ                           | 説明                             |
| -------------------------------- | -------------------------------- |
| `Content-Type: application/json` | リクエストボディがある場合に必須 |
| `Authorization: Bearer <JWT>`    | 全業務エンドポイントで必須       |

---

## 認証

**方式**: Bearer Token（JWT）

Amazon Cognito User Pool で発行した ID トークンまたはアクセストークンを使用します。  
API Gateway の JWT Authorizer が検証し、Lambda 側では `event.requestContext.authorizer.jwt.claims` から `sub` などを取得して `userId` として使用します。

```http
Authorization: Bearer <Cognito JWT>
```

`/health` を除くすべての業務エンドポイントは認証が必須です。

---

## エラーレスポンス形式

エラー時は以下の JSON 形式で返されます。

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "Recipe not found",
    "details": null
  }
}
```

| ステータスコード            | 説明                                                 |
| --------------------------- | ---------------------------------------------------- |
| `400 Bad Request`           | バリデーションエラー等                               |
| `401 Unauthorized`          | JWT 不正・欠如（API Gateway 側で弾かれる場合もある） |
| `403 Forbidden`             | 認証は通っているが対象リソースの `userId` が異なる等 |
| `404 Not Found`             | 該当リソースが存在しない                             |
| `500 Internal Server Error` | 予期せぬ例外                                         |

---

## API 一覧

> 現時点でバックエンド実装済みなのは `/health`、`GET /recipes`、`POST /recipes`、`GET /recipes/{recipeId}` です。  
> それ以外の操作は仕様先行で定義しており、現在呼び出すと `404 Not Found` になります。

### Recipes API（レシピ管理）

| メソッド | パス                  | 概要                                       |
| -------- | --------------------- | ------------------------------------------ |
| `GET`    | `/recipes`            | ログインユーザーの全レシピ一覧を取得       |
| `POST`   | `/recipes`            | 新しいレシピを材料と共に登録               |
| `GET`    | `/recipes/{recipeId}` | 特定レシピの詳細情報（材料一覧含む）を取得 |
| `PUT`    | `/recipes/{recipeId}` | 既存レシピを材料リストごと全体更新         |

### Menus API（献立管理）

| メソッド | パス              | 概要                                              |
| -------- | ----------------- | ------------------------------------------------- |
| `GET`    | `/menus`          | 指定期間内の献立を取得（未指定時は今日から7日分） |
| `POST`   | `/menus`          | 日付・食事区分にレシピを紐付けた献立を登録        |
| `PUT`    | `/menus/{menuId}` | 既存の献立（1件）を更新                           |
| `DELETE` | `/menus/{menuId}` | 献立から1件のレシピを削除                         |

### Shopping List API（買い物リスト）

| メソッド | パス             | 概要                                               |
| -------- | ---------------- | -------------------------------------------------- |
| `GET`    | `/shopping-list` | 指定期間の献立から必要な材料の合計量を計算して返す |

### Health Check API

| メソッド | パス      | 概要                             |
| -------- | --------- | -------------------------------- |
| `GET`    | `/health` | デバッグ・疎通確認用（認証不要） |

---

## `docs/04-api-design.md` との対応

| docs/04-api-design.md セクション | OpenAPI パス                                         |
| -------------------------------- | ---------------------------------------------------- |
| 1. 共通仕様（認証・エラー）      | `components/securitySchemes`, `components/responses` |
| 2. Recipes API                   | `/recipes`, `/recipes/{recipeId}`                    |
| 3. Menus API                     | `/menus`, `/menus/{menuId}`                          |
| 4. Shopping List API             | `/shopping-list`                                     |
| 5. Health Check API              | `/health`                                            |
