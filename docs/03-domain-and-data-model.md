# 03. Domain & Data Model

このドキュメントでは、本アプリケーションで扱う**ドメインモデル**と、  
それを実現するための **PostgreSQL テーブル設計** を記載する。

- 現時点では「単一ユーザー（自分）専用」の想定だが、
- ユーザー起点のテーブル（`recipes`・`menus`・`pantry_items`）には `user_id` カラムを持たせておき、将来的な複数ユーザー対応の余地を残す。
- `recipe_ingredients` は `recipe_id` 外部キー経由でユーザーコンテキストを継承するため、`user_id` は持たない。

---

## 1. ドメイン概要

### 1.1 主なドメインオブジェクト

- **Recipe（レシピ）**
  - レシピ本などに載っている料理の定義
  - 名前・出典・基本人数・材料リストなど

- **Ingredient（材料：レシピごとの材料）**
  - 各レシピに紐づく「材料」とその「分量・単位」
  - 「材料マスタ」テーブルは現時点では持たず、  
    レシピごとの材料として扱う

- **Menu（献立）**
  - 特定の日付・食事区分（朝/昼/夜など）ごとに、どのレシピを作るかを表す
  - 1つの献立レコードが「ある日付のある食事区分に対する1つのレシピ＋人数」を表現

- **ShoppingList（買い物リスト）**
  - テーブルは持たない、"計算結果"としての一時的なオブジェクト
  - 指定期間内の献立から必要な材料を集計した結果

- **PantryItem（常備品／在庫）**（将来的な拡張）
  - 家に常備していて毎回買わないもの（塩・醤油・砂糖など）を管理する候補
  - 現時点ではテーブル設計のみメモしておく

---

## 2. テーブル一覧

現時点で扱うテーブルは以下の通り。

1. `recipes` … レシピ本体
2. `recipe_ingredients` … レシピに紐づく材料
3. `menus` … 日付・食事区分ごとの献立
4. （将来）`pantry_items` … 常備品／在庫管理用

---

## 3. recipes テーブル

### 3.1 用途

- レシピ本体の情報を保持するテーブル。
- レシピ名、出典（本のタイトル・ページ）、何人分か、作成日時などを持つ。

### 3.2 カラム定義

| カラム名        | 型          | NULL     | 説明                               |
| --------------- | ----------- | -------- | ---------------------------------- |
| `id`            | UUID        | NOT NULL | レシピの主キー（UUID）             |
| `user_id`       | VARCHAR     | NOT NULL | ユーザーの識別子                   |
| `name`          | VARCHAR     | NOT NULL | レシピ名（例：「鶏の照り焼き」）   |
| `source_book`   | VARCHAR     | NULL     | 出典本のタイトル                   |
| `source_page`   | INTEGER     | NULL     | 出典本のページ番号                 |
| `base_servings` | INTEGER     | NOT NULL | 基本の人数（例：2）                |
| `memo`          | TEXT        | NULL     | 味のメモ・次回の調整用コメントなど |
| `created_at`    | TIMESTAMPTZ | NOT NULL | 作成日時（UTC）                    |
| `updated_at`    | TIMESTAMPTZ | NOT NULL | 更新日時（UTC）                    |

### 3.3 主キー / インデックス

- **PRIMARY KEY**: `id`
  - UUID はアプリ側（Hono）で生成して INSERT する（`DEFAULT gen_random_uuid()` を設定しても可）
- **INDEX**: `(user_id)` — ユーザーごとのレシピ一覧取得に使用

### 3.4 想定アクセスパターン

1. **レシピ一覧を取得する**
   - `SELECT * FROM recipes WHERE user_id = $1`

2. **レシピ詳細を取得する**
   - `SELECT * FROM recipes WHERE id = $1 AND user_id = $2`

3. （将来）出典本ごとのフィルタ
   - `SELECT * FROM recipes WHERE user_id = $1 AND source_book = $2`

### 3.5 レコード例

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

---

## 4. recipe_ingredients テーブル

### 4.1 用途

- 各レシピに紐づく「材料」と「分量」を保持するテーブル。
- 1レシピにつき複数の材料行を持つ。

### 4.2 カラム定義

| カラム名          | 型      | NULL     | 説明                                           |
| ----------------- | ------- | -------- | ---------------------------------------------- |
| `id`              | UUID    | NOT NULL | 主キー（UUID）                                 |
| `recipe_id`       | UUID    | NOT NULL | 紐づくレシピの ID（`recipes.id` への外部キー） |
| `ingredient_name` | VARCHAR | NOT NULL | 材料名（例：「玉ねぎ」「鶏もも肉」）           |
| `quantity_value`  | NUMERIC | NULL     | 数値で表せる分量（例：300, 2）                 |
| `quantity_text`   | VARCHAR | NULL     | 文字列の分量（例：「少々」「適量」）           |
| `unit`            | VARCHAR | NOT NULL | 単位（g, 個, ml, 大さじ, 小さじ, 少々 など）   |
| `note`            | VARCHAR | NULL     | 切り方などのメモ（「薄切り」「1cm角」など）    |

> `quantity_value` と `quantity_text` はどちらか一方を設定する（両方 NULL は不可）。  
> API レスポンスでは `quantity` として `number | string` にまとめて返す。

### 4.3 主キー / 外部キー / インデックス

- **PRIMARY KEY**: `id`（UUID はアプリ側で生成）
- **FOREIGN KEY**: `recipe_id` → `recipes(id)` ON DELETE CASCADE
- **INDEX**: `(recipe_id)` — レシピごとの材料一覧取得に使用

### 4.4 想定アクセスパターン

1. **特定レシピの材料一覧を取得**
   - `SELECT * FROM recipe_ingredients WHERE recipe_id = $1`

2. **買い物リスト用の材料取得**
   - 指定期間の `menus` から `recipe_id` リストを取得し、
   - `SELECT * FROM recipe_ingredients WHERE recipe_id = ANY($1)`
   - サーバー側で材料名ごとに集計

### 4.5 レコード例

```json
[
  {
    "id": "a1b2c3d4-...",
    "recipe_id": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
    "ingredient_name": "鶏もも肉",
    "quantity_value": 300,
    "quantity_text": null,
    "unit": "g",
    "note": null
  },
  {
    "id": "d4e5f6a7-...",
    "recipe_id": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
    "ingredient_name": "しょうゆ",
    "quantity_value": 2,
    "quantity_text": null,
    "unit": "大さじ",
    "note": null
  }
]
```

---

## 5. menus テーブル

### 5.1 用途

- 「いつ・どの食事（朝/昼/夜）で・どのレシピを・何人分作るか」を表現するテーブル。
- 1件のレコードが、**ある日付のある食事区分に対する1つのレシピ** に対応する。

### 5.2 カラム定義

| カラム名     | 型          | NULL     | 説明                                                            |
| ------------ | ----------- | -------- | --------------------------------------------------------------- |
| `id`         | UUID        | NOT NULL | 主キー（UUID、API 上の `menuId`）                               |
| `user_id`    | VARCHAR     | NOT NULL | ユーザーの識別子                                                |
| `date`       | DATE        | NOT NULL | 献立の日付（`YYYY-MM-DD`）                                      |
| `meal_type`  | VARCHAR     | NOT NULL | 食事区分。`BREAKFAST` / `LUNCH` / `DINNER` / `OTHER` のいずれか |
| `recipe_id`  | UUID        | NOT NULL | 紐づくレシピ（`recipes.id` への外部キー）                       |
| `servings`   | NUMERIC     | NOT NULL | この献立における実人数（例：1, 2）                              |
| `memo`       | TEXT        | NULL     | メモ（任意）                                                    |
| `created_at` | TIMESTAMPTZ | NOT NULL | 作成日時（UTC）                                                 |
| `updated_at` | TIMESTAMPTZ | NOT NULL | 更新日時（UTC）                                                 |

### 5.3 主キー / 外部キー / インデックス

- **PRIMARY KEY**: `id`（UUID はアプリ側で生成）
- **FOREIGN KEY**: `recipe_id` → `recipes(id)`
- **INDEX**: `(user_id, date)` — ユーザーごとの期間検索に使用

### 5.4 想定アクセスパターン

1. **指定期間の献立一覧を取得する**
   - `SELECT * FROM menus WHERE user_id = $1 AND date BETWEEN $2 AND $3`

2. **特定日付の献立をまとめて取得**
   - `SELECT * FROM menus WHERE user_id = $1 AND date = $2`

### 5.5 レコード例

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

---

## 6. ShoppingList（買い物リスト）ドメイン

### 6.1 用途

- 指定期間内の献立から必要な材料を集計し、**一時的な計算結果として返す**。
- テーブルは持たず、Hono / サーバー側で動的に生成する。

### 6.2 データ構造（レスポンス例）

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

### 6.3 集計ロジック概要（サーバー側）

1. `GET /shopping-list?from&to` でリクエストを受ける
2. `menus` テーブルから指定期間内の献立を取得
3. 各 `recipe_id` について `recipe_ingredients` を取得
4. `servings` と `base_servings` の比率で材料をスケーリングする
5. `ingredient_name` + `unit` ごとに合計値を算出
6. 上記構造でレスポンスとして返却

---

## 7. pantry_items テーブル（将来の拡張）

### 7.1 用途

- 常備している材料（塩、醤油、砂糖など）や在庫を管理する。
- 買い物リストから除外したい材料を指定できるようにする。

### 7.2 カラム定義（案）

| カラム名           | 型          | NULL     | 説明                                      |
| ------------------ | ----------- | -------- | ----------------------------------------- |
| `id`               | UUID        | NOT NULL | 主キー                                    |
| `user_id`          | VARCHAR     | NOT NULL | ユーザーの識別子                          |
| `ingredient_name`  | VARCHAR     | NOT NULL | 材料名                                    |
| `always_available` | BOOLEAN     | NOT NULL | true の場合、買い物リストから基本的に除外 |
| `quantity`         | NUMERIC     | NULL     | 在庫数（数値管理する場合）                |
| `unit`             | VARCHAR     | NULL     | 単位                                      |
| `updated_at`       | TIMESTAMPTZ | NOT NULL | 更新日時（UTC）                           |

### 7.3 想定アクセスパターン

- ロード時に、ユーザーの `pantry_items` を全件取得してローカルにキャッシュ
- 買い物リスト作成時に、`always_available = true` の材料を除外または別枠表示

---

## 8. 型定義（フロント／バック共通イメージ）

※ 実装時に共有できるよう、TypeScript の型イメージをここにメモしておく。

```ts
// Domain-level types (概念としての型)

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
  quantity: number | string; // API レスポンス上は quantity_value / quantity_text を統合して返す
  unit: string;
  note?: string | null;
};

export type MenuItem = {
  menuId: string;
  userId: string;
  date: string; // YYYY-MM-DD
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
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  items: ShoppingListItem[];
};
```

---

## 9. 今後の見直しポイント（メモ）

- `recipe_ingredients.quantity` を `quantity_value` / `quantity_text` に分離しているが、
  API レスポンスでは `number | string` に統合するため、変換ロジックをどこに置くか設計する

- `menus` の期間検索は `(user_id, date)` インデックスで十分か、件数が増えたら見直す

- 将来的に複数ユーザー対応する場合、`user_id` をサーバー側（Cloudflare Access JWT）から取得するロジックを追加する

---
