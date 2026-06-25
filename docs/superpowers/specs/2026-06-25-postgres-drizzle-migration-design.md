# データストアをPostgreSQL + Drizzle ORMへ移行する設計

- 対象Issue: [#128](https://github.com/Kawatan1927/cooking-planner/issues/128)
- 関連Issue: [#136](https://github.com/Kawatan1927/cooking-planner/issues/136)（CDKのDynamoDB定義削除・別対応）
- 作成日: 2026-06-25

## 1. ゴール

`backend/` のデータアクセス層を、DynamoDB + AWS SDK v3 から **PostgreSQL（ローカル） + Drizzle ORM** に置き換える。
APIのレスポンス形式（`docs/04-api-design.md`）は一切変えない。

## 2. 前提・方針

- 仕様のソースオブトゥルースは `docs/` であり、Issue本文と差異がある場合は `docs/` を優先する（`AGENTS.md`）。
  - `docs/03-domain-and-data-model.md` は既にPostgreSQL前提のリレーショナル設計になっている。本設計はこれに忠実に従う。
- DBドライバーは **postgres.js**（`postgres` パッケージ）+ `drizzle-orm/postgres-js`。
- データアクセスは **ドメインごとの薄いリポジトリ層** に隔離する。ハンドラーはリポジトリを呼ぶだけにする。
- テストは **リポジトリ層をモック** する方式に書き換える（実DB不要・CIでそのまま動く）。
- 既存データのマイグレーションは行わない（新規構築前提）。
- 認証スタブ（`shared/auth.ts` の `getUserId`）はそのまま。`userId` でのスコープ制御も維持する。
- CDK（`infra/`）のDynamoDB定義削除は本対応のスコープ外（#136 で対応）。

## 3. スキーマ設計（`backend/src/shared/schema.ts`）

Drizzle のテーブル定義。カラム名は snake_case、TypeScript プロパティ名は camelCase（Drizzle のカラム名マッピングを利用）。
内容は `docs/03-domain-and-data-model.md` に忠実で、ドキュメントが文章で記述している整合性ルールをDBレベルの制約として追加するのみ。**`docs/03` の修正は不要**。

### recipes

| カラム          | 型          | NULL     | 備考                                                     |
| --------------- | ----------- | -------- | -------------------------------------------------------- |
| `id`            | uuid        | NOT NULL | 主キー。アプリ側で `crypto.randomUUID()` 生成して INSERT |
| `user_id`       | varchar     | NOT NULL |                                                          |
| `name`          | varchar     | NOT NULL |                                                          |
| `source_book`   | varchar     | NULL     |                                                          |
| `source_page`   | integer     | NULL     |                                                          |
| `base_servings` | integer     | NOT NULL |                                                          |
| `memo`          | text        | NULL     |                                                          |
| `created_at`    | timestamptz | NOT NULL |                                                          |
| `updated_at`    | timestamptz | NOT NULL |                                                          |

- INDEX: `(user_id)`

### recipe_ingredients

| カラム            | 型      | NULL     | 備考                                 |
| ----------------- | ------- | -------- | ------------------------------------ |
| `id`              | uuid    | NOT NULL | 主キー                               |
| `recipe_id`       | uuid    | NOT NULL | FK → `recipes(id)` ON DELETE CASCADE |
| `ingredient_name` | varchar | NOT NULL |                                      |
| `quantity_value`  | numeric | NULL     | 数値分量                             |
| `quantity_text`   | varchar | NULL     | 文字列分量（「少々」など）           |
| `unit`            | varchar | NOT NULL |                                      |
| `note`            | varchar | NULL     |                                      |

- INDEX: `(recipe_id)`
- CHECK: `(quantity_value IS NULL) <> (quantity_text IS NULL)`（どちらか一方のみ設定）
- `user_id` は持たない（`recipe_id` 経由でユーザーコンテキストを継承）

### menus

| カラム       | 型          | NULL     | 備考                                                 |
| ------------ | ----------- | -------- | ---------------------------------------------------- |
| `id`         | uuid        | NOT NULL | 主キー                                               |
| `user_id`    | varchar     | NOT NULL |                                                      |
| `date`       | date        | NOT NULL | `YYYY-MM-DD`                                         |
| `meal_type`  | varchar     | NOT NULL | CHECK で `BREAKFAST`/`LUNCH`/`DINNER`/`OTHER` に限定 |
| `recipe_id`  | uuid        | NOT NULL | FK → `recipes(id)`                                   |
| `servings`   | numeric     | NOT NULL |                                                      |
| `memo`       | text        | NULL     |                                                      |
| `created_at` | timestamptz | NOT NULL |                                                      |
| `updated_at` | timestamptz | NOT NULL |                                                      |

- INDEX: `(user_id, date)`
- `meal_type` は PG enum ではなく varchar + CHECK（PG固有機能への過度な依存を避ける）

## 4. マッピング層（API契約を変えないための変換）

`docs/04-api-design.md` のレスポンス形式は不変。DBの物理表現とAPI表現の差をリポジトリ層で吸収する。

- **id ↔ recipeId / menuId**: DBは `id`、APIは `recipeId` / `menuId`。リポジトリで行→ドメインオブジェクトに変換する。
  内部ドメイン型（`shared/types.ts`）は従来どおり `recipeId` / `menuId` を維持し、ハンドラー・レスポンス整形はほぼ変更しない。
- **quantity の分割/統合**:
  - 書き込み: API入力 `quantity: number | string` を `quantity_value`（number時）/ `quantity_text`（string時）に振り分ける。
  - 読み出し: `quantity_value` が非NULLなら数値、そうでなければ `quantity_text` を `quantity` として返す。
  - **postgres.js は `numeric` を文字列で返す**ため、`quantity_value` と `servings` は読み出し時に `Number()` で数値化する（買い物リストの数値計算がこれに依存）。
- **日時**: `timestamptz` は `Date` を `.toISOString()` で `2025-11-21T12:00:00.000Z` 形式に。`created_at`/`updated_at` は書き込み時に `new Date()`。
- **date**: Drizzle の `date({ mode: 'string' })` で `YYYY-MM-DD` 文字列として扱う。
- 材料の読み出し順は `ORDER BY ingredient_name`（決定的。現状の名前順結果と一致）。

## 5. アーキテクチャ / ファイル構成

### 新規

- `backend/src/shared/db.ts`: `DATABASE_URL` から postgres.js クライアントを生成し、`drizzle()` でラップした `db` をエクスポート。接続は遅延（初回クエリ時）。
- `backend/src/shared/schema.ts`: 上記3テーブルの Drizzle 定義。
- `backend/src/recipes/repository.ts`: レシピ・材料のデータアクセス関数。
  - `listRecipesByUser(userId)`
  - `findRecipeWithIngredients(userId, recipeId)` → 本体（userIdスコープ）＋材料、なければ null
  - `createRecipeWithIngredients(recipe, ingredients)` … `db.transaction` 内で recipes INSERT → recipe_ingredients 一括 INSERT
  - `replaceRecipeWithIngredients(userId, recipeId, recipe, ingredients)` … `db.transaction` 内で本体 UPDATE（存在＋userId確認）→ 旧材料 DELETE → 新材料 INSERT。対象なしは null
  - `getRecipeForUser(userId, recipeId)` / `getIngredientsByRecipeId(recipeId)`（買い物リスト用）
- `backend/src/menus/repository.ts`:
  - `listMenusInRange(userId, from, to)`
  - `findMenuByIdForUser(userId, menuId)`
  - `createMenu(menu)` / `updateMenu(userId, menuId, fields)` / `deleteMenu(userId, menuId)`
- `backend/drizzle.config.ts`: schema パス、`out: 'drizzle'`、`dialect: 'postgresql'`、`dbCredentials.url = DATABASE_URL`。
- `backend/drizzle/0000_*.sql`（＋メタ）: 初期マイグレーション（生成してコミット）。
- `backend/.env.example`: `DATABASE_URL` と `PORT` の例。

### 変更

- `backend/src/recipes/*.ts`（createRecipe / updateRecipe / getRecipes / getRecipeById）: DynamoDB呼び出しをリポジトリ呼び出しに置換。作成/更新の手動補償処理は `db.transaction` に置き換えて削除。
- `backend/src/menus/*.ts`（createMenu / updateMenu / deleteMenu / getMenus）: 同上。`utils.ts` の `findMenuByMenuId` は menus リポジトリへ吸収。
- `backend/src/shoppingList/getShoppingList.ts`: `fetchMenusInRange` / `fetchRecipe` / `fetchIngredients` をリポジトリ呼び出しに置換。集計ロジック・レスポンス形式は不変。
- `backend/src/shared/types.ts`: `RecipeIngredient` から `userId` を削除（FK設計に合わせる）。
- `backend/package.json`:
  - 依存追加: `drizzle-orm`, `postgres`
  - devDependencies 追加: `drizzle-kit`
  - 依存削除: `@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`
  - スクリプト追加: `db:generate`（`drizzle-kit generate`）, `db:migrate`（`drizzle-kit migrate`）
- `backend/AGENTS.md`: DynamoDB前提のルール（AWS SDK利用・`userId`条件必須・Lambda SDK禁止など）を、Drizzle/PostgreSQL前提のルールに差し替え。
- `.gitignore`: `/backend/.env` を追加（`.env.example` はコミット対象）。

### 削除

- `backend/src/shared/dynamodb.ts`
- `backend/src/menus/utils.ts`（リポジトリへ吸収する場合）

## 6. トランザクション方針（`docs/05 §9` 準拠）

- `POST /recipes` / `PUT /recipes/{recipeId}` は単一の `db.transaction` で実行し、途中失敗時はDBが自動ロールバック。
  DynamoDB時代のベストエフォート補償処理は不要になり削除する。
- `PUT /menus/{menuId}` は単一行 UPDATE（旧DynamoDB実装のSK変更に伴うdelete+putトランザクションは不要）。

## 7. エラーハンドリング

- DynamoDB固有のエラー名分岐（`ResourceNotFoundException` / `AccessDeniedException` / `ConditionalCheckFailedException`）を削除。
- `badRequest` / `notFound` / `internalServerError`（`shared/http.ts`）と `docs/04` のエラー形式 `{ error: { code, message, details } }` はそのまま維持。
- 想定外の例外は `internalServerError` に集約（`app.ts` の `onError` も従来どおり）。

## 8. テスト方針

- 既存4テストを、`shared/dynamodb` ではなく **リポジトリモジュールを `vi.mock`** する形に書き換える。
  - `recipes/getRecipeById.test.ts` → recipes リポジトリをモック
  - `menus/updateMenu.test.ts` → menus リポジトリをモック
  - `shoppingList/getShoppingList.test.ts` → recipes / menus リポジトリをモック
  - `app.test.ts` → DB非依存（health / 404 等）であれば変更最小
- リポジトリの import が丸ごとモックされるため、`db.ts`（postgres.js）はテスト時に評価・接続されない。
- 検証観点はAPIのステータス・レスポンス本文（`docs/04` 準拠）を中心とし、DBアクセスの詳細実装には依存しすぎない。

## 9. 環境変数 / 起動

- `DATABASE_URL`（例: `postgresql://user:password@localhost:5432/cooking_planner`）を `backend/.env` で管理（`docs/05 §4.2`）。
- 起動手順: PostgreSQL起動 → `db:migrate` でテーブル作成 → `bun run dev` / `bun run start`。

## 10. 受け入れ条件（Issue #128）との対応

- [ ] `drizzle-kit migrate` でローカルDBにテーブルが作成される → §5 マイグレーション
- [ ] レシピCRUDがPostgreSQL経由で動作 → §5 recipes リポジトリ＋ハンドラー
- [ ] 献立・買い物リストAPIがPostgreSQL経由で動作 → §5 menus リポジトリ＋shoppingList
- [ ] 型チェック・lintが通る → PR前チェック（`bun run lint` / `type-check`）
- [ ] DynamoDBモック前提テストをPostgreSQL（リポジトリモック）対応に更新 → §8

## 11. スコープ外（本Issueでは扱わない）

- 既存データの移行
- 認証方式の移行（別Issue）
- CDKのDynamoDB定義削除（#136）
- PantryItems テーブルの実装（将来拡張）
