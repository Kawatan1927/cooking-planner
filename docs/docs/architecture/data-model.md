---
id: data-model
title: データモデル
sidebar_position: 4
---

このドキュメントでは、本アプリケーションで扱うドメインモデルと PostgreSQL テーブル設計の概要を記載します。詳細なソースオブトゥルースは `docs/03-domain-and-data-model.md` です。

## ドメイン概要

- **Recipe**: レシピ本などに載っている料理の定義。名前・出典・基本人数・材料リストを持ちます。
- **RecipeIngredient**: レシピごとの材料と分量を表します。
- **Menu**: 日付・食事区分ごとに、どのレシピを何人分作るかを表します。
- **ShoppingList**: 指定期間の献立から材料を集計した一時的な計算結果です。
- **PantryItem**: 常備品や在庫管理の将来拡張候補です。

## テーブル一覧

| テーブル名           | 用途                             |
| -------------------- | -------------------------------- |
| `recipes`            | レシピ本体                       |
| `recipe_ingredients` | レシピに紐づく材料               |
| `menus`              | 日付・食事区分ごとの献立         |
| `pantry_items`       | 常備品／在庫管理用の将来拡張候補 |

## 主な設計方針

- `recipes` と `menus` は `user_id` カラムを持ちます。
- `recipe_ingredients` は `recipe_id` 外部キーで `recipes` に紐づきます。
- 買い物リストはテーブル化せず、Hono server が `menus` と `recipe_ingredients` から集計します。
- API 上の `recipeId` / `menuId` は DB の `id` 列に対応します。
- `quantity` は数値または文字列を扱えるよう、保存時は数値用・文字列用のカラムに分けます。

## 代表的なアクセスパターン

### レシピ一覧

```sql
SELECT *
FROM recipes
WHERE user_id = $1;
```

### レシピ詳細

```sql
SELECT *
FROM recipes
WHERE id = $1
  AND user_id = $2;
```

### 指定期間の献立

```sql
SELECT *
FROM menus
WHERE user_id = $1
  AND date BETWEEN $2 AND $3;
```

### 買い物リスト生成

1. `menus` から指定期間の献立を取得する。
2. 対象レシピの `recipes.base_servings` を取得する。
3. `recipe_ingredients` から材料を取得する。
4. `servings / base_servings` で分量を調整する。
5. `ingredient_name + unit` ごとに集計してレスポンスを返す。
