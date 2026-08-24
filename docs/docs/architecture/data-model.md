---
id: data-model
title: データモデル
sidebar_position: 4
---

このドキュメントでは、本アプリケーションで扱うドメインモデルと、それを実現するための PostgreSQL テーブル設計を記載する。

現時点では単一ユーザー専用の想定だが、ユーザー起点のテーブル（`recipes`、`menus`、`pantry_items`）には `user_id` カラムを持たせ、将来的な複数ユーザー対応の余地を残す。`recipe_ingredients` は `recipe_id` 外部キー経由でユーザーコンテキストを継承するため、`user_id` は持たない。

## ドメイン概要

- **Recipe（レシピ）**: レシピ本などに載っている料理の定義。名前・出典・基本人数・材料リストなどを持つ。
- **RecipeIngredient（材料）**: 各レシピに紐づく材料と、その分量・単位を表す。材料マスタは現時点では持たず、レシピごとの材料として扱う。
- **Menu（献立）**: 特定の日付・食事区分ごとに、どのレシピを何人分作るかを表す。1件の献立レコードは「ある日付のある食事区分に対する1つのレシピ＋人数」に対応する。
- **ShoppingList（買い物リスト）**: テーブルは持たない。指定期間内の献立から必要な材料を集計した、一時的な計算結果として扱う。
- **PantryItem（常備品／在庫）**: 家に常備していて毎回買わないものを管理する将来拡張候補。

## テーブル一覧

| テーブル名           | 用途                             |
| -------------------- | -------------------------------- |
| `recipes`            | レシピ本体                       |
| `recipe_ingredients` | レシピに紐づく材料               |
| `menus`              | 日付・食事区分ごとの献立         |
| `pantry_items`       | 常備品／在庫管理用の将来拡張候補 |

## `recipes` テーブル

### 用途

レシピ本体の情報を保持する。レシピ名、出典（本のタイトル・ページ）、何人分か、作成日時などを持つ。

### カラム定義

| カラム名        | 型          | NULL     | 説明                               |
| --------------- | ----------- | -------- | ---------------------------------- |
| `id`            | UUID        | NOT NULL | レシピの主キー（UUID）             |
| `user_id`       | VARCHAR     | NOT NULL | ユーザーの識別子                   |
| `name`          | VARCHAR     | NOT NULL | レシピ名                           |
| `source_book`   | VARCHAR     | NULL     | 出典本のタイトル                   |
| `source_page`   | INTEGER     | NULL     | 出典本のページ番号                 |
| `base_servings` | INTEGER     | NOT NULL | 基本の人数                         |
| `memo`          | TEXT        | NULL     | 味のメモ・次回の調整用コメントなど |
| `created_at`    | TIMESTAMPTZ | NOT NULL | 作成日時（UTC）                    |
| `updated_at`    | TIMESTAMPTZ | NOT NULL | 更新日時（UTC）                    |

### 主キー / インデックス

- Primary key: `id`
- UUID はアプリ側で生成して INSERT する。`DEFAULT gen_random_uuid()` を設定してもよい。
- Index: `(user_id)`。ユーザーごとのレシピ一覧取得に使用する。

### 想定アクセスパターン

```sql
-- レシピ一覧を取得する
SELECT *
FROM recipes
WHERE user_id = $1;

-- レシピ詳細を取得する
SELECT *
FROM recipes
WHERE id = $1
  AND user_id = $2;

-- 将来: 出典本ごとのフィルタ
SELECT *
FROM recipes
WHERE user_id = $1
  AND source_book = $2;
```

### レコード例

```json
{
  "id": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "user_id": "user-001",
  "name": "鶏の照り焼き",
  "source_book": "週末の定番おかず",
  "source_page": 34,
  "base_servings": 2,
  "memo": "少し甘め。砂糖を控えめにしても良さそう。",
  "created_at": "2025-11-21T12:00:00.000Z",
  "updated_at": "2025-11-21T12:00:00.000Z"
}
```

## `recipe_ingredients` テーブル

### 用途

各レシピに紐づく「材料」と「分量」を保持する。1レシピにつき複数の材料行を持つ。

### カラム定義

| カラム名          | 型      | NULL     | 説明                                           |
| ----------------- | ------- | -------- | ---------------------------------------------- |
| `id`              | UUID    | NOT NULL | 主キー（UUID）                                 |
| `recipe_id`       | UUID    | NOT NULL | 紐づくレシピの ID（`recipes.id` への外部キー） |
| `ingredient_name` | VARCHAR | NOT NULL | 材料名                                         |
| `quantity_value`  | NUMERIC | NULL     | 数値で表せる分量                               |
| `quantity_text`   | VARCHAR | NULL     | 文字列の分量                                   |
| `unit`            | VARCHAR | NOT NULL | 単位                                           |
| `note`            | VARCHAR | NULL     | 切り方などのメモ                               |

`quantity_value` と `quantity_text` はどちらか一方を設定する。両方 NULL は不可。API レスポンスでは `quantity` として `number | string` にまとめて返す。

### 主キー / 外部キー / インデックス

- Primary key: `id`
- Foreign key: `recipe_id` → `recipes(id)` ON DELETE CASCADE
- Index: `(recipe_id)`。レシピごとの材料一覧取得に使用する。

### 想定アクセスパターン

```sql
-- 特定レシピの材料一覧を取得する
SELECT *
FROM recipe_ingredients
WHERE recipe_id = $1;

-- 買い物リスト用の材料取得
SELECT *
FROM recipe_ingredients
WHERE recipe_id = ANY($1);
```

買い物リスト生成では、指定期間の `menus` から `recipe_id` リストを取得し、サーバー側で材料名ごとに集計する。

### レコード例

```json
[
  {
    "id": "a1b2c3d4-0000-0000-0000-000000000000",
    "recipe_id": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
    "ingredient_name": "鶏もも肉",
    "quantity_value": 300,
    "quantity_text": null,
    "unit": "g",
    "note": null
  },
  {
    "id": "d4e5f6a7-0000-0000-0000-000000000000",
    "recipe_id": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
    "ingredient_name": "しょうゆ",
    "quantity_value": 2,
    "quantity_text": null,
    "unit": "大さじ",
    "note": null
  }
]
```

## `menus` テーブル

### 用途

「いつ・どの食事（朝 / 昼 / 夜）で・どのレシピを・何人分作るか」を表現する。1件のレコードが、ある日付のある食事区分に対する1つのレシピに対応する。

### カラム定義

| カラム名     | 型          | NULL     | 説明                                                            |
| ------------ | ----------- | -------- | --------------------------------------------------------------- |
| `id`         | UUID        | NOT NULL | 主キー（UUID、API 上の `menuId`）                               |
| `user_id`    | VARCHAR     | NOT NULL | ユーザーの識別子                                                |
| `date`       | DATE        | NOT NULL | 献立の日付（`YYYY-MM-DD`）                                      |
| `meal_type`  | VARCHAR     | NOT NULL | 食事区分。`BREAKFAST` / `LUNCH` / `DINNER` / `OTHER` のいずれか |
| `recipe_id`  | UUID        | NOT NULL | 紐づくレシピ（`recipes.id` への外部キー）                       |
| `servings`   | NUMERIC     | NOT NULL | この献立における実人数                                          |
| `memo`       | TEXT        | NULL     | メモ（任意）                                                    |
| `created_at` | TIMESTAMPTZ | NOT NULL | 作成日時（UTC）                                                 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新日時（UTC）                                                 |

### 主キー / 外部キー / インデックス

- Primary key: `id`
- Foreign key: `recipe_id` → `recipes(id)`
- Index: `(user_id, date)`。ユーザーごとの期間検索に使用する。

### 想定アクセスパターン

```sql
-- 指定期間の献立一覧を取得する
SELECT *
FROM menus
WHERE user_id = $1
  AND date BETWEEN $2 AND $3;

-- 特定日付の献立をまとめて取得する
SELECT *
FROM menus
WHERE user_id = $1
  AND date = $2;
```

### レコード例

```json
{
  "id": "5b5af0bb-3c10-45e7-8f5e-6f541b2da111",
  "user_id": "user-001",
  "date": "2025-11-21",
  "meal_type": "DINNER",
  "recipe_id": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "servings": 1,
  "memo": null,
  "created_at": "2025-11-20T21:00:00.000Z",
  "updated_at": "2025-11-20T21:00:00.000Z"
}
```

## ShoppingList ドメイン

### 用途

指定期間内の献立から必要な材料を集計し、一時的な計算結果として返す。テーブルは持たず、Hono server 側で動的に生成する。

### データ構造

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

### 集計ロジック

1. `GET /shopping-list?from&to` でリクエストを受ける。
2. `menus` テーブルから指定期間内の献立を取得する。
3. 各 `recipe_id` について `recipes` と `recipe_ingredients` を取得する。
4. `servings / base_servings` の比率で材料をスケーリングする。
5. `ingredient_name + unit` ごとに合計値を算出する。
6. レスポンス形式へ整形して返却する。

## `pantry_items` テーブル（将来の拡張）

### 用途

常備している材料（塩、醤油、砂糖など）や在庫を管理する。買い物リストから除外したい材料を指定できるようにする。

### カラム定義案

| カラム名           | 型          | NULL     | 説明                                      |
| ------------------ | ----------- | -------- | ----------------------------------------- |
| `id`               | UUID        | NOT NULL | 主キー                                    |
| `user_id`          | VARCHAR     | NOT NULL | ユーザーの識別子                          |
| `ingredient_name`  | VARCHAR     | NOT NULL | 材料名                                    |
| `always_available` | BOOLEAN     | NOT NULL | true の場合、買い物リストから基本的に除外 |
| `quantity`         | NUMERIC     | NULL     | 在庫数（数値管理する場合）                |
| `unit`             | VARCHAR     | NULL     | 単位                                      |
| `updated_at`       | TIMESTAMPTZ | NOT NULL | 更新日時（UTC）                           |

### 想定アクセスパターン

- ロード時にユーザーの `pantry_items` を全件取得してローカルにキャッシュする。
- 買い物リスト作成時に、`always_available = true` の材料を除外または別枠表示する。

## 型定義イメージ

実装時に共有できるよう、TypeScript の型イメージを残す。

```ts
export type Recipe = {
  recipeId: string;
  userId: string;
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredient = {
  recipeId: string;
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note?: string | null;
};

export type MenuItem = {
  menuId: string;
  userId: string;
  date: string;
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "OTHER";
  recipeId: string;
  servings: number;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ShoppingListItem = {
  ingredientName: string;
  totalQuantity: number | string;
  unit: string;
};

export type ShoppingList = {
  from: string;
  to: string;
  items: ShoppingListItem[];
};
```

## 今後の見直しポイント

- `recipe_ingredients` の `quantity_value` / `quantity_text` は、API レスポンスでは `quantity: number | string` に統合するため、変換ロジックをどこに置くか設計する。
- `menus` の期間検索は `(user_id, date)` インデックスで十分か、件数が増えたら見直す。
- 将来的に複数ユーザー対応する場合、`user_id` を Tailscale identity / header または Cloudflare Access JWT から取得するロジックを追加する。
