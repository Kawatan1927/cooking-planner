# backend 実装ノート

> **注意**: このファイルは旧 `infra/lambda/` 時代（DynamoDB + Lambda 構成）の実装メモをベースにしています。
> 現在のバックエンドは **Bun + Hono + Drizzle ORM + PostgreSQL** 構成に移行済みです（Issue #128）。
> コード例・ファイルパス・テーブル設計の記述は歴史的経緯として残しますが、最新の仕様は `docs/` 配下を参照してください。

## Recipes API

### GET /recipes 実装

#### 概要
`docs/04-api-design.md` で規定された `GET /recipes` エンドポイントを処理します。

#### 現在の実装（Drizzle/PostgreSQL）

- ハンドラー: `backend/src/recipes/`
- リポジトリ: `backend/src/recipes/repository.ts`
- スキーマ: `backend/src/shared/schema.ts`（`recipes` / `recipe_ingredients` テーブル）
- DB 接続: `backend/src/shared/db.ts`（`DATABASE_URL` 環境変数）

クエリは `user_id` でスコープされます。

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

---

## Menus API

### GET /menus, POST /menus, PUT /menus/{menuId}, DELETE /menus/{menuId} 実装

#### 概要
`docs/04-api-design.md` で規定された Menus API の全エンドポイントを処理します。

#### 現在の実装（Drizzle/PostgreSQL）

- ハンドラー: `backend/src/menus/`
- リポジトリ: `backend/src/menus/repository.ts`
- スキーマ: `backend/src/shared/schema.ts`（`menus` テーブル）

#### PostgreSQL テーブル設計

**テーブル名**: `menus`

| カラム | 型 | 説明 |
|---|---|---|
| `id` | `uuid` (PK) | メニュー ID（API 上の `menuId`） |
| `user_id` | `varchar(255)` | ユーザー識別子（Cognito `sub`） |
| `date` | `date` | 日付 |
| `meal_type` | `varchar(20)` CHECK | `BREAKFAST` / `LUNCH` / `DINNER` / `OTHER` |
| `recipe_id` | `uuid` (FK) | 参照レシピ |
| `servings` | `numeric(6,2)` | 人数 |
| `created_at` | `timestamptz` | 作成日時 |
| `updated_at` | `timestamptz` | 更新日時 |

`user_id` でスコープした日付範囲クエリで `GET /menus` を実装しています。

#### GET /menus の動作仕様

1. `from` / `to` クエリパラメータを検証（未指定時は今日から 7 日分を自動設定）
2. `user_id` と日付範囲で `menus` テーブルを検索
3. 取得したアイテムをレスポンス形式にマッピングして返却

#### POST /menus の動作仕様

1. リクエストボディを JSON パースしてバリデーション
2. `mealType` は `BREAKFAST` / `LUNCH` / `DINNER` / `OTHER` のいずれかに制限
3. `menuId` は PostgreSQL の `gen_random_uuid()` / `randomUUID()` で生成
4. `menus` テーブルに INSERT

#### PUT /menus/{menuId} の動作仕様

1. `id` と `user_id` で既存アイテムを検索（存在しない場合は 404）
2. リクエストボディをバリデーション
3. `menus` テーブルを UPDATE

#### DELETE /menus/{menuId} の動作仕様

1. `id` と `user_id` で既存アイテムを検索（存在しない場合は 404）
2. `menus` テーブルから DELETE
3. 204 No Content を返却

#### エラーコード一覧

| コード | HTTP | 説明 |
|---|---|---|
| `UNAUTHORIZED` | 401 | userId が取得できない |
| `BAD_REQUEST` | 400 | バリデーションエラー（日付形式・mealType・必須フィールドなど） |
| `MENU_NOT_FOUND` | 404 | 指定された `menuId` の献立が存在しない |
| `INTERNAL_SERVER_ERROR` | 500 | 予期せぬエラー |

#### 必要な環境変数

- `DATABASE_URL`: PostgreSQL 接続文字列（例: `postgres://user:pass@localhost:5432/cooking_planner`）
