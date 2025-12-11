# 03. Domain & Data Model

このドキュメントでは、本アプリケーションで扱う**ドメインモデル**と、  
それを実現するための **DynamoDB テーブル設計** を記載する。

- 現時点では「単一ユーザー（自分）専用」の想定だが、
- テーブルには `userId` 属性を持たせておき、将来的な複数ユーザー対応の余地を残す。

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
  - DynamoDBに保存しない、“計算結果”としての一時的なオブジェクト
  - 指定期間内の献立から必要な材料を集計した結果

- **PantryItem（常備品／在庫）**（将来的な拡張）
  - 家に常備していて毎回買わないもの（塩・醤油・砂糖など）を管理する候補
  - 現時点ではテーブル設計のみメモしておく

---

## 2. DynamoDB テーブル一覧

現時点で扱うテーブルは以下の通り。

1. `Recipes` … レシピ本体
2. `RecipeIngredients` … レシピに紐づく材料
3. `Menus` … 日付・食事区分ごとの献立
4. （将来）`PantryItems` … 常備品／在庫管理用

いずれもパーティションキー＋ソートキーを持たせ、  
**主キークエリで基本的なアクセスパターンをカバーできるようにする。**

---

## 3. Recipes テーブル

### 3.1 用途

- レシピ本体の情報を保持するテーブル。
- レシピ名、出典（本のタイトル・ページ）、何人分か、作成日時などを持つ。

### 3.2 キースキーマ

- **Partition Key (PK)**: `userId` (string)
- **Sort Key (SK)**: `recipeId` (string, UUID)

※ 単一ユーザー前提であっても、`userId` を含めておくことで将来的な複数ユーザー対応が容易になる。

### 3.3 主な属性

- `userId`: string  
  - ユーザーの識別子（現状は固定値でも可）
- `recipeId`: string  
  - レシピのUUID
- `name`: string  
  - レシピ名（例：「鶏の照り焼き」）
- `sourceBook`: string (nullable)  
  - 出典本のタイトル（例：「〇〇の和食レシピ」）
- `sourcePage`: number (nullable)  
  - 出典本のページ番号
- `baseServings`: number  
  - このレシピが何人分の分量で書かれているか（例：2）
- `memo`: string (nullable)  
  - 味のメモ・次回の調整用コメントなど
- `createdAt`: string (ISO8601)  
  - 作成日時
- `updatedAt`: string (ISO8601)  
  - 更新日時

### 3.4 想定アクセスパターン

1. **レシピ一覧を取得する**
   - 条件：あるユーザーの全レシピ
   - DynamoDB 操作：`Query`（`PK = userId`）

2. **レシピ詳細を取得する**
   - 条件：`userId`＋`recipeId`
   - DynamoDB 操作：`GetItem`

3. （将来）出典本ごとのフィルタ／検索
   - 必要であれば `GSI` を追加する可能性あり  
     （例：GSI1: `sourceBook` をパーティションキーにしてQuery）

### 3.5 アイテム例

```json
{
  "userId": "user-001",
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "name": "鶏の照り焼き",
  "sourceBook": "週末の定番おかず",
  "sourcePage": 34,
  "baseServings": 2,
  "memo": "少し甘め。砂糖を控えめにしても良さそう。",
  "createdAt": "2025-11-21T12:00:00.000Z",
  "updatedAt": "2025-11-21T12:00:00.000Z"
}
````

---

## 4. RecipeIngredients テーブル

### 4.1 用途

* 各レシピに紐づく「材料」と「分量」を保持するテーブル。
* 1レシピにつき複数の材料アイテムを持つ。

### 4.2 キースキーマ

* **Partition Key (PK)**: `userId` (string)
* **Sort Key (SK)**: `recipeId#ingredientName` (string)

> メモ：
>
> * `recipeId` と `ingredientName` を結合した文字列を SK として使用する。
> * これにより `PK = userId AND begins_with(SK, recipeId#)` で、
    >   あるレシピに紐づく材料一覧を `Query` で取得できる。

別案として `PK: recipeId, SK: ingredientName` もあるが、
マルチユーザー化を見据えて `userId` をPKに統一する構成にしている。

### 4.3 主な属性

* `userId`: string
* `recipeId`: string
* `ingredientName`: string

    * 材料名（例：「玉ねぎ」「鶏もも肉」）
* `quantity`: number or string

    * 分量
    * 数値で扱える場合は number、
      「少々」のような曖昧表現が必要な場合は string を許容する
      → 実装では `quantityValue` (number | null), `quantityText` (string | null) に分ける案もあり
* `unit`: string

    * g, 個, ml, 大さじ, 小さじ, 少々 など
* `note`: string (nullable)

    * 切り方などのメモ（「薄切り」「1cm角に切る」など）

### 4.4 想定アクセスパターン

1. **特定レシピの材料一覧取得**

    * 条件：`userId` + `recipeId`
    * DynamoDB 操作：

        * `Query` with

            * `KeyConditionExpression: userId = :uid AND begins_with(SK, :recipeIdPrefix)`

2. **買い物リスト用の材料取得**

    * 指定期間の `Menus` から `recipeId` リストを取得し、
    * その `recipeId` ごとに材料を `Query` で取得
    * Lambda内で材料名ごとに集計

### 4.5 アイテム例

```json
{
  "userId": "user-001",
  "SK": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11#鶏もも肉",
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "ingredientName": "鶏もも肉",
  "quantity": 300,
  "unit": "g",
  "note": null
}
```

```json
{
  "userId": "user-001",
  "SK": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11#しょうゆ",
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "ingredientName": "しょうゆ",
  "quantity": 2,
  "unit": "大さじ",
  "note": null
}
```

---

## 5. Menus テーブル

### 5.1 用途

* 「いつ・どの食事（朝/昼/夜）で・どのレシピを・何人分作るか」を表現するテーブル。
* 1件のアイテムが、**ある日付のある食事区分に対する1つのレシピ** に対応する。

### 5.2 キースキーマ

* **Partition Key (PK)**: `userId` (string)
* **Sort Key (SK)**: `date#mealType#menuId` (string)

ここで：

* `date`: `YYYY-MM-DD` 形式の文字列（例：`2025-11-21`）
* `mealType`: `"BREAKFAST" | "LUNCH" | "DINNER" | "OTHER"` など
* `menuId`: 同じ日・同じ食事区分に複数レシピを登録する可能性を考慮した一意ID（UUID など）

### 5.3 主な属性

* `userId`: string
* `date`: string (`YYYY-MM-DD`)
* `mealType`: string（例：`"BREAKFAST"`, `"LUNCH"`, `"DINNER"`）
* `menuId`: string（UUID）
* `recipeId`: string
* `servings`: number

    * この献立における実人数（例：1人分 / 2人分）
* `memo`: string (nullable)
* `createdAt`: string (ISO8601)
* `updatedAt`: string (ISO8601)

### 5.4 想定アクセスパターン

1. **特定期間の献立一覧を取得する**

    * 条件：ユーザー＋日付期間（例：2025-11-21〜2025-11-27）
    * DynamoDB 操作：

        * 単一 PK (`userId`) なので、純粋な日付範囲での `Query` は直接はできない
        * 対応案：

            * `Menus` テーブルに GSI を張る
            * もしくは、当面は「当日 or 数日分」を前提に `Query + FilterExpression` を利用

※ 個人用＆件数が少ない前提のため、**最初の段階ではシンプルさを優先し、
`userId` 固定で `Query` → Lambda側で日付フィルタ**という方針でも良い。

将来的に件数が増えた場合は、
`GSI: PK = date, SK = userId#mealType#menuId` のようなインデックスを追加する。

2. **特定日付の献立をまとめて取得**

    * `Query`（`userId = :uid`）＋ Filterで `date = :date` でも十分対応可能。

### 5.5 アイテム例

```json
{
  "userId": "user-001",
  "SK": "2025-11-21#DINNER#5b5af0bb-3c10-45e7-8f5e-6f541b2da111",
  "date": "2025-11-21",
  "mealType": "DINNER",
  "menuId": "5b5af0bb-3c10-45e7-8f5e-6f541b2da111",
  "recipeId": "c5b4a271-4dc4-4f30-9b61-1e5b10cbfd11",
  "servings": 1,
  "memo": null,
  "createdAt": "2025-11-20T21:00:00.000Z",
  "updatedAt": "2025-11-20T21:00:00.000Z"
}
```

---

## 6. ShoppingList（買い物リスト）ドメイン

### 6.1 用途

* 指定期間内の献立から必要な材料を集計し、**一時的な計算結果として返す**。
* DynamoDB にテーブルは作らず、Lambda 内で動的に生成する。

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

### 6.3 集計ロジック概要（Lambda内）

1. `GET /shopping-list?from&to` でリクエストを受ける
2. `Menus` テーブルから指定期間内の献立を取得
3. 各 `recipeId` について `RecipeIngredients` を Query する
4. `servings` と `baseServings` の比率で材料をスケーリングする
5. `ingredientName` + `unit` ごとに合計値を算出
6. 上記構造でレスポンスとして返却

---

## 7. PantryItems テーブル（将来の拡張）

### 7.1 用途

* 常備している材料（塩、醤油、砂糖など）や在庫を管理する。
* 買い物リストから除外したい材料を指定できるようにする。

### 7.2 キースキーマ（案）

* **Partition Key (PK)**: `userId` (string)
* **Sort Key (SK)**: `ingredientName` (string)

### 7.3 主な属性（案）

* `userId`: string
* `ingredientName`: string
* `alwaysAvailable`: boolean

    * true の場合、買い物リストから基本的に除外する
* `quantity`: number (nullable)

    * 在庫を数値で管理したくなった場合に使用
* `unit`: string (nullable)
* `updatedAt`: string (ISO8601)

### 7.4 想定アクセスパターン

* ロード時に、ユーザーの `PantryItems` を全件取得してローカルにキャッシュ
* 買い物リスト作成時に、`alwaysAvailable = true` の材料を除外または別枠表示

---

## 8. 型定義（フロント／バック共通イメージ）

※ 実装時に共有できるよう、TypeScript の型イメージをここにメモしておく。

```ts
// Domain-level types (概念としての型)

export type Recipe = {
  userId: string;
  recipeId: string;
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RecipeIngredient = {
  userId: string;
  recipeId: string;
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note?: string | null;
};

export type MenuItem = {
  userId: string;
  date: string; // YYYY-MM-DD
  mealType: "BREAKFAST" | "LUNCH" | "DINNER" | "OTHER";
  menuId: string;
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
  to: string;   // YYYY-MM-DD
  items: ShoppingListItem[];
};
```

---

## 9. 今後の見直しポイント（メモ）

* `RecipeIngredients` で `quantity` を number と string に分離するか検討

    * 例：`quantityValue` (number?) + `quantityText` (string?) 形式
* `Menus` の期間検索の効率化

    * 必要になったら `GSI` を追加して、`date` をキーにした検索を可能にする
* 単一テーブル設計（Single Table Design）への移行の可能性

    * `PK: userId, SK: <type>#<id>...` という形に統合する案もあり
    * まずは複数テーブル構成で実装し、必要に応じてリファクタリングで対応

---
