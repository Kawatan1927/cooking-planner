# PostgreSQL + Drizzle ORM 移行 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `backend/` のデータアクセス層を DynamoDB + AWS SDK v3 から PostgreSQL + Drizzle ORM（postgres.js）へ置き換える。API レスポンス形式は不変。

**Architecture:** ドメインごとの薄いリポジトリ層（`recipes/repository.ts`・`menus/repository.ts`）に全 SQL を隔離し、ハンドラーはリポジトリを呼ぶだけにする。DB ↔ API の差（`id`↔`recipeId`/`menuId`、`quantity` 分割、numeric→number）はリポジトリ＋純粋関数のマッパーで吸収する。テストはリポジトリ層を `vi.mock` する。

**Tech Stack:** Bun, Hono, Drizzle ORM, postgres.js, drizzle-kit, Vitest, TypeScript。

## Global Constraints

- API のエンドポイント・レスポンス形式（`docs/04-api-design.md`）を変更しない。エラーは `{ error: { code, message, details } }`。
- スキーマは `docs/03-domain-and-data-model.md` 準拠（`id` 主キー、`recipe_ingredients` は `user_id` なし、`quantity_value`/`quantity_text` 分割、`menus.servings` は numeric）。
- DB ドライバーは postgres.js（`drizzle-orm/postgres-js`）。
- `userId` は `shared/auth.ts` の `getUserId(c)` から取得し、`recipes`・`menus` はクエリで `user_id` スコープを必須にする。`recipe_ingredients` は `recipe_id` 経由で継承（自前の userId カラムは持たない）。
- PG 固有機能に過度に依存しない（`meal_type` は enum ではなく varchar + CHECK）。
- 出力（コミットメッセージ等）は日本語。コミットメッセージ形式は `<type>: <日本語要約>`。
- ブランチ `feature/128-migrate-datastore-to-postgresql-drizzle` で作業（作成済み）。
- 全コミットメッセージ末尾に `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` を付ける。
- 既存データ移行・認証移行・CDK の DynamoDB 定義削除（#136）はスコープ外。
- 材料の読み出し順は `ingredient_name` 昇順。

---

### Task 1: 基盤（依存・Drizzleスキーマ・接続・設定・初期マイグレーション）

**Files:**
- Modify: `backend/package.json`（依存・スクリプト）
- Modify: `.gitignore`（`/backend/.env` 追加）
- Create: `backend/.env.example`
- Create: `backend/drizzle.config.ts`
- Create: `backend/src/shared/schema.ts`
- Create: `backend/src/shared/db.ts`
- Create: `backend/drizzle/0000_*.sql`（生成物）

**Interfaces:**
- Produces:
  - `schema.recipes` / `schema.recipeIngredients` / `schema.menus`（Drizzle テーブル）
  - `db`（`drizzle-orm/postgres-js` の `PostgresJsDatabase`、`shared/db.ts` から export）

- [ ] **Step 1: 依存の入れ替え**

`backend/` で実行（依存解決はバージョン自動選択）:

```bash
cd backend
bun remove @aws-sdk/client-dynamodb @aws-sdk/lib-dynamodb
bun add drizzle-orm postgres
bun add -d drizzle-kit
cd ..
```

- [ ] **Step 2: package.json にスクリプトを追加**

`backend/package.json` の `scripts` に2行追加（既存行は変更しない）:

```json
    "test": "vitest run",
    "test:watch": "vitest",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate"
```

- [ ] **Step 3: .gitignore に backend/.env を追加**

`.gitignore` の「バックエンド（Hono サーバー）の依存」ブロックに追記:

```
# バックエンド（Hono サーバー）の依存
/backend/node_modules
/backend/.env
```

- [ ] **Step 4: backend/.env.example を作成**

`backend/.env.example`:

```
# Hono サーバーのリスニングポート（任意、デフォルト 3000）
PORT=3000

# PostgreSQL 接続文字列
DATABASE_URL=postgresql://user:password@localhost:5432/cooking_planner
```

- [ ] **Step 5: Drizzle スキーマを作成**

`backend/src/shared/schema.ts`:

```ts
import { sql } from 'drizzle-orm';
import {
  check,
  date,
  index,
  integer,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';

/**
 * recipes テーブル。API 上の recipeId は本テーブルの id（UUID）。
 * @see docs/03-domain-and-data-model.md §3
 */
export const recipes = pgTable(
  'recipes',
  {
    id: uuid('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    name: varchar('name').notNull(),
    sourceBook: varchar('source_book'),
    sourcePage: integer('source_page'),
    baseServings: integer('base_servings').notNull(),
    memo: text('memo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [index('recipes_user_id_idx').on(table.userId)]
);

/**
 * recipe_ingredients テーブル。user_id は持たず recipe_id 経由で継承。
 * quantity_value / quantity_text はどちらか一方のみ設定（CHECK 制約）。
 * @see docs/03-domain-and-data-model.md §4
 */
export const recipeIngredients = pgTable(
  'recipe_ingredients',
  {
    id: uuid('id').primaryKey(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id, { onDelete: 'cascade' }),
    ingredientName: varchar('ingredient_name').notNull(),
    quantityValue: numeric('quantity_value'),
    quantityText: varchar('quantity_text'),
    unit: varchar('unit').notNull(),
    note: varchar('note'),
  },
  table => [
    index('recipe_ingredients_recipe_id_idx').on(table.recipeId),
    check(
      'recipe_ingredients_quantity_check',
      sql`(${table.quantityValue} IS NULL) <> (${table.quantityText} IS NULL)`
    ),
  ]
);

/**
 * menus テーブル。API 上の menuId は本テーブルの id（UUID）。
 * meal_type は CHECK 制約で許可値に限定。
 * @see docs/03-domain-and-data-model.md §5
 */
export const menus = pgTable(
  'menus',
  {
    id: uuid('id').primaryKey(),
    userId: varchar('user_id').notNull(),
    date: date('date', { mode: 'string' }).notNull(),
    mealType: varchar('meal_type').notNull(),
    recipeId: uuid('recipe_id')
      .notNull()
      .references(() => recipes.id),
    servings: numeric('servings').notNull(),
    memo: text('memo'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull(),
  },
  table => [
    index('menus_user_id_date_idx').on(table.userId, table.date),
    check('menus_meal_type_check', sql`${table.mealType} IN ('BREAKFAST', 'LUNCH', 'DINNER', 'OTHER')`),
  ]
);
```

- [ ] **Step 6: 接続クライアントを作成**

`backend/src/shared/db.ts`:

```ts
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * PostgreSQL 接続（postgres.js）。
 * 接続は遅延（初回クエリ時）に確立される。
 * テストではリポジトリ層をモックするため、本モジュールは評価されない。
 */
const connectionString = process.env.DATABASE_URL ?? '';
const client = postgres(connectionString);

export const db = drizzle(client, { schema });
```

- [ ] **Step 7: drizzle.config.ts を作成**

`backend/drizzle.config.ts`:

```ts
import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/shared/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
});
```

- [ ] **Step 8: 初期マイグレーションを生成**

```bash
cd backend && bun run db:generate && cd ..
```

Expected: `backend/drizzle/0000_*.sql` と `backend/drizzle/meta/` が生成される。

- [ ] **Step 9: 生成 SQL を確認**

`backend/drizzle/0000_*.sql` を開き、次が含まれることを目視確認:
- `CREATE TABLE "recipes"` / `"recipe_ingredients"` / `"menus"`
- `recipe_ingredients` の `CONSTRAINT ... CHECK ((quantity_value is null) <> (quantity_text is null))` 相当
- `menus` の `CHECK (meal_type IN ('BREAKFAST', 'LUNCH', 'DINNER', 'OTHER'))` 相当
- `recipe_id` の `FOREIGN KEY ... REFERENCES "recipes"` と `ON DELETE cascade`（recipe_ingredients 側）
- 3つの INDEX

- [ ] **Step 10: 型チェック**

```bash
bun run backend:type-check
```

Expected: エラーなし（`db.ts` / `schema.ts` / `drizzle.config.ts` が型エラーを出さない）。

- [ ] **Step 11: コミット**

```bash
git add backend/package.json backend/bun.lock .gitignore backend/.env.example backend/drizzle.config.ts backend/src/shared/schema.ts backend/src/shared/db.ts backend/drizzle
git commit -m "$(printf 'feat: Drizzle ORM とスキーマ・初期マイグレーションを追加\n\n- drizzle-orm / postgres / drizzle-kit を導入し AWS SDK を削除\n- recipes / recipe_ingredients / menus の Drizzle スキーマを定義\n- DATABASE_URL 接続と初期マイグレーションを追加\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 2: quantity マッパー（純粋関数・TDD）と型の更新

**Files:**
- Create: `backend/src/shared/quantity.ts`
- Test: `backend/src/shared/quantity.test.ts`
- Modify: `backend/src/shared/types.ts`（`RecipeIngredient` から `userId` を削除）

**Interfaces:**
- Produces:
  - `splitQuantity(quantity: number | string): { quantityValue: string | null; quantityText: string | null }`
  - `mergeQuantity(quantityValue: string | null, quantityText: string | null): number | string`

- [ ] **Step 1: 失敗するテストを書く**

`backend/src/shared/quantity.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { mergeQuantity, splitQuantity } from './quantity';

describe('splitQuantity', () => {
  it('数値は quantityValue に文字列化して入れる', () => {
    expect(splitQuantity(300)).toEqual({ quantityValue: '300', quantityText: null });
  });

  it('小数も文字列化して保持する', () => {
    expect(splitQuantity(1.5)).toEqual({ quantityValue: '1.5', quantityText: null });
  });

  it('文字列は quantityText に入れる', () => {
    expect(splitQuantity('少々')).toEqual({ quantityValue: null, quantityText: '少々' });
  });
});

describe('mergeQuantity', () => {
  it('quantityValue があれば数値に変換して返す', () => {
    expect(mergeQuantity('300', null)).toBe(300);
  });

  it('小数の quantityValue も数値で返す', () => {
    expect(mergeQuantity('1.5', null)).toBe(1.5);
  });

  it('quantityValue が null なら quantityText を返す', () => {
    expect(mergeQuantity(null, '少々')).toBe('少々');
  });
});
```

- [ ] **Step 2: 失敗を確認**

```bash
cd backend && bun run test -- quantity && cd ..
```

Expected: FAIL（`./quantity` が解決できない / 関数未定義）。

- [ ] **Step 3: 実装**

`backend/src/shared/quantity.ts`:

```ts
/**
 * API 入力の quantity（number | string）を DB の
 * quantity_value（数値分量）/ quantity_text（文字列分量）に振り分ける。
 */
export const splitQuantity = (
  quantity: number | string
): { quantityValue: string | null; quantityText: string | null } =>
  typeof quantity === 'number'
    ? { quantityValue: String(quantity), quantityText: null }
    : { quantityValue: null, quantityText: quantity };

/**
 * DB の quantity_value / quantity_text を API の quantity（number | string）に統合する。
 * postgres.js は numeric を文字列で返すため、数値分量は Number() で復元する。
 */
export const mergeQuantity = (
  quantityValue: string | null,
  quantityText: string | null
): number | string => (quantityValue !== null ? Number(quantityValue) : (quantityText ?? ''));
```

- [ ] **Step 4: テストが通ることを確認**

```bash
cd backend && bun run test -- quantity && cd ..
```

Expected: PASS（6 ケース）。

- [ ] **Step 5: RecipeIngredient 型から userId を削除**

`backend/src/shared/types.ts` の `RecipeIngredient` を次に置き換える:

```ts
export interface RecipeIngredient {
  recipeId: string;
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note?: string;
}
```

- [ ] **Step 6: 型チェック**

```bash
bun run backend:type-check
```

Expected: 既存ハンドラーで `userId` 参照によるエラーが出る場合があるが、本 Task では `types.ts` の編集のみ確認する。エラーが `RecipeIngredient.userId` 関連のみであれば後続 Task（3〜7）で解消されるため許容。それ以外の新規エラーがないこと。

> 注: この時点では旧 DynamoDB ハンドラーがまだ残っているため `bun run backend:type-check` 全体は通らない可能性がある。Task 3〜8 で順次解消し、Task 8 で全体グリーンを確認する。本 Step では `quantity.ts` / `types.ts` 自体に型エラーがないことだけを確認する。

- [ ] **Step 7: コミット**

```bash
git add backend/src/shared/quantity.ts backend/src/shared/quantity.test.ts backend/src/shared/types.ts
git commit -m "$(printf 'feat: quantity 変換マッパーを追加し RecipeIngredient 型を整理\n\n- splitQuantity / mergeQuantity を追加（numeric の文字列⇔数値変換）\n- FK 設計に合わせ RecipeIngredient から userId を削除\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 3: recipes リポジトリ

**Files:**
- Create: `backend/src/recipes/repository.ts`

**Interfaces:**
- Consumes: `db`（Task 1）, `recipes`/`recipeIngredients`（Task 1）, `splitQuantity`/`mergeQuantity`（Task 2）, `Recipe`/`RecipeIngredient`（`shared/types.ts`）
- Produces:
  - `interface NewRecipeInput { userId: string; name: string; sourceBook: string | null; sourcePage: number | null; baseServings: number; memo: string | null; }`
  - `interface NewIngredientInput { ingredientName: string; quantity: number | string; unit: string; note: string | null; }`
  - `interface RecipeWithIngredients { recipe: Recipe; ingredients: RecipeIngredient[]; }`
  - `listRecipesByUser(userId: string): Promise<Recipe[]>`
  - `findRecipeWithIngredients(userId: string, recipeId: string): Promise<RecipeWithIngredients | null>`
  - `createRecipeWithIngredients(input: NewRecipeInput, ingredients: NewIngredientInput[]): Promise<string>`（戻り値は recipeId）
  - `replaceRecipeWithIngredients(userId: string, recipeId: string, input: Omit<NewRecipeInput, 'userId'>, ingredients: NewIngredientInput[]): Promise<boolean>`（対象なしは false）

- [ ] **Step 1: 実装**

`backend/src/recipes/repository.ts`:

```ts
import { randomUUID } from 'crypto';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '../shared/db';
import { recipeIngredients, recipes } from '../shared/schema';
import { mergeQuantity, splitQuantity } from '../shared/quantity';
import type { Recipe, RecipeIngredient } from '../shared/types';

export interface NewRecipeInput {
  userId: string;
  name: string;
  sourceBook: string | null;
  sourcePage: number | null;
  baseServings: number;
  memo: string | null;
}

export interface NewIngredientInput {
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note: string | null;
}

export interface RecipeWithIngredients {
  recipe: Recipe;
  ingredients: RecipeIngredient[];
}

const toRecipe = (row: typeof recipes.$inferSelect): Recipe => ({
  recipeId: row.id,
  userId: row.userId,
  name: row.name,
  sourceBook: row.sourceBook ?? undefined,
  sourcePage: row.sourcePage ?? undefined,
  baseServings: row.baseServings,
  memo: row.memo ?? undefined,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const toIngredient = (row: typeof recipeIngredients.$inferSelect): RecipeIngredient => ({
  recipeId: row.recipeId,
  ingredientName: row.ingredientName,
  quantity: mergeQuantity(row.quantityValue, row.quantityText),
  unit: row.unit,
  note: row.note ?? undefined,
});

const toIngredientRows = (recipeId: string, ingredients: NewIngredientInput[]) =>
  ingredients.map(ingredient => {
    const { quantityValue, quantityText } = splitQuantity(ingredient.quantity);
    return {
      id: randomUUID(),
      recipeId,
      ingredientName: ingredient.ingredientName,
      quantityValue,
      quantityText,
      unit: ingredient.unit,
      note: ingredient.note,
    };
  });

export const listRecipesByUser = async (userId: string): Promise<Recipe[]> => {
  const rows = await db.select().from(recipes).where(eq(recipes.userId, userId));
  return rows.map(toRecipe);
};

export const findRecipeWithIngredients = async (
  userId: string,
  recipeId: string
): Promise<RecipeWithIngredients | null> => {
  const recipeRows = await db
    .select()
    .from(recipes)
    .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)));

  const recipeRow = recipeRows[0];
  if (!recipeRow) {
    return null;
  }

  const ingredientRows = await db
    .select()
    .from(recipeIngredients)
    .where(eq(recipeIngredients.recipeId, recipeId))
    .orderBy(asc(recipeIngredients.ingredientName));

  return {
    recipe: toRecipe(recipeRow),
    ingredients: ingredientRows.map(toIngredient),
  };
};

export const createRecipeWithIngredients = async (
  input: NewRecipeInput,
  ingredients: NewIngredientInput[]
): Promise<string> => {
  const recipeId = randomUUID();
  const now = new Date();

  await db.transaction(async tx => {
    await tx.insert(recipes).values({
      id: recipeId,
      userId: input.userId,
      name: input.name,
      sourceBook: input.sourceBook,
      sourcePage: input.sourcePage,
      baseServings: input.baseServings,
      memo: input.memo,
      createdAt: now,
      updatedAt: now,
    });

    if (ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(toIngredientRows(recipeId, ingredients));
    }
  });

  return recipeId;
};

export const replaceRecipeWithIngredients = async (
  userId: string,
  recipeId: string,
  input: Omit<NewRecipeInput, 'userId'>,
  ingredients: NewIngredientInput[]
): Promise<boolean> => {
  const now = new Date();

  return db.transaction(async tx => {
    const updated = await tx
      .update(recipes)
      .set({
        name: input.name,
        sourceBook: input.sourceBook,
        sourcePage: input.sourcePage,
        baseServings: input.baseServings,
        memo: input.memo,
        updatedAt: now,
      })
      .where(and(eq(recipes.id, recipeId), eq(recipes.userId, userId)))
      .returning({ id: recipes.id });

    if (updated.length === 0) {
      return false;
    }

    await tx.delete(recipeIngredients).where(eq(recipeIngredients.recipeId, recipeId));

    if (ingredients.length > 0) {
      await tx.insert(recipeIngredients).values(toIngredientRows(recipeId, ingredients));
    }

    return true;
  });
};
```

- [ ] **Step 2: 型チェック（本ファイル）**

```bash
bun run backend:type-check
```

Expected: `recipes/repository.ts` に起因する型エラーがないこと（旧ハンドラー由来のエラーは Task 4 で解消されるため、この時点では全体は通らなくてよい）。`bunx`/`tsc` 直呼びは禁止、必ずスクリプト経由で実行する。

- [ ] **Step 3: コミット**

```bash
git add backend/src/recipes/repository.ts
git commit -m "$(printf 'feat: recipes の Drizzle リポジトリを追加\n\n- 一覧/詳細取得・作成・置換更新を実装（作成/更新はトランザクション）\n- 行とドメイン型のマッピング（id↔recipeId, quantity 統合）を集約\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 4: recipes バリデーション共通化・ハンドラー移行・テスト更新

**Files:**
- Create: `backend/src/recipes/validation.ts`
- Modify: `backend/src/recipes/getRecipes.ts`
- Modify: `backend/src/recipes/getRecipeById.ts`
- Modify: `backend/src/recipes/createRecipe.ts`
- Modify: `backend/src/recipes/updateRecipe.ts`
- Test: `backend/src/recipes/getRecipeById.test.ts`（書き換え）

**Interfaces:**
- Consumes: `listRecipesByUser`/`findRecipeWithIngredients`/`createRecipeWithIngredients`/`replaceRecipeWithIngredients`（Task 3）
- Produces:
  - `interface RecipeBody { name: string; sourceBook?: string | null; sourcePage?: number | null; baseServings: number; memo?: string | null; ingredients: Array<{ ingredientName: string; quantity: number | string; unit: string; note?: string | null }>; }`
  - `validateRecipeBody(body: RecipeBody): HandlerResult | null`

- [ ] **Step 1: 共通バリデーションを作成**

`backend/src/recipes/validation.ts`:

```ts
import { HandlerResult, badRequest } from '../shared/http';
import { isNonEmptyString, isPositiveNumber } from '../shared/validation';

export interface RecipeBody {
  name: string;
  sourceBook?: string | null;
  sourcePage?: number | null;
  baseServings: number;
  memo?: string | null;
  ingredients: Array<{
    ingredientName: string;
    quantity: number | string;
    unit: string;
    note?: string | null;
  }>;
}

/**
 * POST/PUT /recipes のリクエストボディを検証する。
 * 問題があれば HandlerResult（400）を、なければ null を返す。
 */
export const validateRecipeBody = (body: RecipeBody): HandlerResult | null => {
  if (!isNonEmptyString(body.name)) {
    return badRequest('Recipe name is required');
  }
  if (!isPositiveNumber(body.baseServings)) {
    return badRequest('baseServings must be a positive number');
  }
  if (!Array.isArray(body.ingredients)) {
    return badRequest('ingredients must be an array');
  }

  const seenNames = new Set<string>();
  for (const ingredient of body.ingredients) {
    if (typeof ingredient !== 'object' || ingredient === null || Array.isArray(ingredient)) {
      return badRequest('Each ingredient must be an object');
    }
    if (!isNonEmptyString(ingredient.ingredientName)) {
      return badRequest('Each ingredient must have a valid ingredientName');
    }
    const normalized = ingredient.ingredientName.toLowerCase().trim();
    if (seenNames.has(normalized)) {
      return badRequest(`Duplicate ingredient name: ${ingredient.ingredientName}`);
    }
    seenNames.add(normalized);

    const hasValidNumericQuantity =
      typeof ingredient.quantity === 'number' && ingredient.quantity > 0;
    const hasValidTextQuantity =
      typeof ingredient.quantity === 'string' && ingredient.quantity.trim().length > 0;
    if (!hasValidNumericQuantity && !hasValidTextQuantity) {
      return badRequest(
        'Each ingredient must have a positive numeric quantity or a non-empty text quantity'
      );
    }
    if (!isNonEmptyString(ingredient.unit)) {
      return badRequest('Each ingredient must have a unit');
    }
  }

  return null;
};
```

- [ ] **Step 2: getRecipes をリポジトリ移行**

`backend/src/recipes/getRecipes.ts` を全置換:

```ts
import type { Context } from 'hono';
import { listRecipesByUser } from './repository';
import { RecipeResponse } from '../shared/types';
import { HandlerResult, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * GET /recipes
 * ログインユーザーの全レシピ一覧を返す。
 */
export const getRecipes = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    console.log(`Fetching recipes for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

    const recipes = await listRecipesByUser(userId);

    const response: RecipeResponse[] = recipes.map(recipe => ({
      recipeId: recipe.recipeId,
      name: recipe.name,
      sourceBook: recipe.sourceBook ?? null,
      sourcePage: recipe.sourcePage ?? null,
      baseServings: recipe.baseServings,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
    }));

    return jsonResponse(200, response);
  } catch (error) {
    console.error('Error fetching recipes:', error);
    return internalServerError('Failed to fetch recipes');
  }
};
```

- [ ] **Step 3: getRecipeById をリポジトリ移行**

`backend/src/recipes/getRecipeById.ts` を全置換:

```ts
import type { Context } from 'hono';
import { findRecipeWithIngredients } from './repository';
import {
  HandlerResult,
  badRequest,
  internalServerError,
  jsonResponse,
  notFound,
} from '../shared/http';
import { getUserId } from '../shared/auth';

interface RecipeIngredientResponse {
  ingredientName: string;
  quantity: number | string;
  unit: string;
  note: string | null;
}

interface RecipeDetailResponse {
  recipeId: string;
  name: string;
  sourceBook: string | null;
  sourcePage: number | null;
  baseServings: number;
  memo: string | null;
  createdAt: string;
  updatedAt: string;
  ingredients: RecipeIngredientResponse[];
}

/**
 * GET /recipes/{recipeId}
 * レシピ本体＋材料一覧を返す。
 */
export const getRecipeById = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const recipeId = c.req.param('recipeId');
    if (!recipeId) {
      return badRequest('Recipe ID is required');
    }

    const result = await findRecipeWithIngredients(userId, recipeId);
    if (!result) {
      return notFound('Recipe not found', 'RECIPE_NOT_FOUND');
    }

    const { recipe, ingredients } = result;
    const response: RecipeDetailResponse = {
      recipeId: recipe.recipeId,
      name: recipe.name,
      sourceBook: recipe.sourceBook ?? null,
      sourcePage: recipe.sourcePage ?? null,
      baseServings: recipe.baseServings,
      memo: recipe.memo ?? null,
      createdAt: recipe.createdAt,
      updatedAt: recipe.updatedAt,
      ingredients: ingredients.map(ingredient => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note ?? null,
      })),
    };

    return jsonResponse(200, response);
  } catch (error) {
    console.error('Error fetching recipe by ID:', error);
    return internalServerError('Failed to fetch recipe');
  }
};
```

- [ ] **Step 4: createRecipe をリポジトリ移行**

`backend/src/recipes/createRecipe.ts` を全置換:

```ts
import type { Context } from 'hono';
import { createRecipeWithIngredients } from './repository';
import { RecipeBody, validateRecipeBody } from './validation';
import { HandlerResult, badRequest, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * POST /recipes
 * 新しいレシピを材料とともに登録する。
 */
export const createRecipe = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    console.log(`Creating recipe for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

    let requestBody: RecipeBody;
    try {
      requestBody = await c.req.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const validationError = validateRecipeBody(requestBody);
    if (validationError) {
      return validationError;
    }

    const recipeId = await createRecipeWithIngredients(
      {
        userId,
        name: requestBody.name,
        sourceBook: requestBody.sourceBook ?? null,
        sourcePage: requestBody.sourcePage ?? null,
        baseServings: requestBody.baseServings,
        memo: requestBody.memo ?? null,
      },
      requestBody.ingredients.map(ingredient => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note ?? null,
      }))
    );

    return jsonResponse(201, { recipeId });
  } catch (error) {
    console.error('Error creating recipe:', error);
    return internalServerError('Failed to create recipe');
  }
};
```

- [ ] **Step 5: updateRecipe をリポジトリ移行**

`backend/src/recipes/updateRecipe.ts` を全置換:

```ts
import type { Context } from 'hono';
import { replaceRecipeWithIngredients } from './repository';
import { RecipeBody, validateRecipeBody } from './validation';
import {
  HandlerResult,
  badRequest,
  internalServerError,
  jsonResponse,
  notFound,
} from '../shared/http';
import { getUserId } from '../shared/auth';

/**
 * PUT /recipes/{recipeId}
 * レシピ本体と材料リストを全置き換えで更新する。
 */
export const updateRecipe = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const recipeId = c.req.param('recipeId');
    if (!recipeId) {
      return badRequest('Recipe ID is required');
    }

    let requestBody: RecipeBody;
    try {
      requestBody = await c.req.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const validationError = validateRecipeBody(requestBody);
    if (validationError) {
      return validationError;
    }

    const updated = await replaceRecipeWithIngredients(
      userId,
      recipeId,
      {
        name: requestBody.name,
        sourceBook: requestBody.sourceBook ?? null,
        sourcePage: requestBody.sourcePage ?? null,
        baseServings: requestBody.baseServings,
        memo: requestBody.memo ?? null,
      },
      requestBody.ingredients.map(ingredient => ({
        ingredientName: ingredient.ingredientName,
        quantity: ingredient.quantity,
        unit: ingredient.unit,
        note: ingredient.note ?? null,
      }))
    );

    if (!updated) {
      return notFound('Recipe not found', 'RECIPE_NOT_FOUND');
    }

    return jsonResponse(200, { recipeId });
  } catch (error) {
    console.error('Error updating recipe:', error);
    return internalServerError('Failed to update recipe');
  }
};
```

- [ ] **Step 6: getRecipeById.test.ts を書き換え（リポジトリをモック）**

`backend/src/recipes/getRecipeById.test.ts` を全置換:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { findRecipeWithIngredientsMock } = vi.hoisted(() => ({
  findRecipeWithIngredientsMock: vi.fn(),
}));

vi.mock('./repository', () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: findRecipeWithIngredientsMock,
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  getUserId: () => 'user-123',
}));

import app from '../app';

describe('GET /recipes/:recipeId', () => {
  beforeEach(() => {
    findRecipeWithIngredientsMock.mockReset();
  });

  it('レシピ本体と材料一覧を返す', async () => {
    findRecipeWithIngredientsMock.mockResolvedValue({
      recipe: {
        recipeId: 'recipe-123',
        userId: 'user-123',
        name: '親子丼',
        sourceBook: '和食本',
        sourcePage: 12,
        baseServings: 2,
        memo: 'メモ',
        createdAt: '2026-05-20T00:00:00.000Z',
        updatedAt: '2026-05-21T00:00:00.000Z',
      },
      ingredients: [
        { recipeId: 'recipe-123', ingredientName: '鶏もも肉', quantity: 300, unit: 'g' },
        { recipeId: 'recipe-123', ingredientName: '卵', quantity: 2, unit: '個', note: '溶く' },
      ],
    });

    const response = await app.request('/recipes/recipe-123');

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      recipeId: 'recipe-123',
      name: '親子丼',
      sourceBook: '和食本',
      sourcePage: 12,
      baseServings: 2,
      memo: 'メモ',
      createdAt: '2026-05-20T00:00:00.000Z',
      updatedAt: '2026-05-21T00:00:00.000Z',
      ingredients: [
        { ingredientName: '鶏もも肉', quantity: 300, unit: 'g', note: null },
        { ingredientName: '卵', quantity: 2, unit: '個', note: '溶く' },
      ],
    });
    expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-123');
  });

  it('別 userId のレシピは取得できず 404 を返す', async () => {
    findRecipeWithIngredientsMock.mockResolvedValue(null);

    const response = await app.request('/recipes/recipe-123');

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'RECIPE_NOT_FOUND', message: 'Recipe not found', details: null },
    });
  });
});
```

- [ ] **Step 7: recipes のテストを実行**

```bash
cd backend && bun run test -- recipes && cd ..
```

Expected: PASS（2 ケース）。

- [ ] **Step 8: コミット**

```bash
git add backend/src/recipes/validation.ts backend/src/recipes/getRecipes.ts backend/src/recipes/getRecipeById.ts backend/src/recipes/createRecipe.ts backend/src/recipes/updateRecipe.ts backend/src/recipes/getRecipeById.test.ts
git commit -m "$(printf 'refactor: recipes ハンドラーを Drizzle リポジトリ経由に移行\n\n- DynamoDB SDK 呼び出しと補償処理を撤去しリポジトリ呼び出しに置換\n- POST/PUT のバリデーションを validation.ts に共通化\n- テストをリポジトリモックへ更新\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 5: menus リポジトリ

**Files:**
- Create: `backend/src/menus/repository.ts`

**Interfaces:**
- Consumes: `db`（Task 1）, `menus`（Task 1）, `Menu`（`shared/types.ts`）
- Produces:
  - `interface NewMenuInput { userId: string; date: string; mealType: Menu['mealType']; recipeId: string; servings: number; memo: string | null; }`
  - `listMenusInRange(userId: string, from: string, to: string): Promise<Menu[]>`
  - `findMenuByIdForUser(userId: string, menuId: string): Promise<Menu | null>`
  - `createMenu(input: NewMenuInput): Promise<string>`（戻り値は menuId）
  - `updateMenuForUser(userId: string, menuId: string, fields: Omit<NewMenuInput, 'userId'>): Promise<boolean>`
  - `deleteMenuForUser(userId: string, menuId: string): Promise<boolean>`

- [ ] **Step 1: 実装**

`backend/src/menus/repository.ts`:

```ts
import { randomUUID } from 'crypto';
import { and, asc, between, eq } from 'drizzle-orm';
import { db } from '../shared/db';
import { menus } from '../shared/schema';
import type { Menu } from '../shared/types';

export interface NewMenuInput {
  userId: string;
  date: string;
  mealType: Menu['mealType'];
  recipeId: string;
  servings: number;
  memo: string | null;
}

const toMenu = (row: typeof menus.$inferSelect): Menu => ({
  menuId: row.id,
  userId: row.userId,
  date: row.date,
  mealType: row.mealType as Menu['mealType'],
  recipeId: row.recipeId,
  servings: Number(row.servings),
  memo: row.memo ?? undefined,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

export const listMenusInRange = async (
  userId: string,
  from: string,
  to: string
): Promise<Menu[]> => {
  const rows = await db
    .select()
    .from(menus)
    .where(and(eq(menus.userId, userId), between(menus.date, from, to)))
    .orderBy(asc(menus.date), asc(menus.mealType));
  return rows.map(toMenu);
};

export const findMenuByIdForUser = async (
  userId: string,
  menuId: string
): Promise<Menu | null> => {
  const rows = await db
    .select()
    .from(menus)
    .where(and(eq(menus.id, menuId), eq(menus.userId, userId)));
  return rows[0] ? toMenu(rows[0]) : null;
};

export const createMenu = async (input: NewMenuInput): Promise<string> => {
  const menuId = randomUUID();
  const now = new Date();
  await db.insert(menus).values({
    id: menuId,
    userId: input.userId,
    date: input.date,
    mealType: input.mealType,
    recipeId: input.recipeId,
    servings: String(input.servings),
    memo: input.memo,
    createdAt: now,
    updatedAt: now,
  });
  return menuId;
};

export const updateMenuForUser = async (
  userId: string,
  menuId: string,
  fields: Omit<NewMenuInput, 'userId'>
): Promise<boolean> => {
  const now = new Date();
  const updated = await db
    .update(menus)
    .set({
      date: fields.date,
      mealType: fields.mealType,
      recipeId: fields.recipeId,
      servings: String(fields.servings),
      memo: fields.memo,
      updatedAt: now,
    })
    .where(and(eq(menus.id, menuId), eq(menus.userId, userId)))
    .returning({ id: menus.id });
  return updated.length > 0;
};

export const deleteMenuForUser = async (userId: string, menuId: string): Promise<boolean> => {
  const deleted = await db
    .delete(menus)
    .where(and(eq(menus.id, menuId), eq(menus.userId, userId)))
    .returning({ id: menus.id });
  return deleted.length > 0;
};
```

- [ ] **Step 2: 型チェック（本ファイル）**

```bash
bun run backend:type-check
```

Expected: `menus/repository.ts` に起因する型エラーがないこと（旧ハンドラー由来のエラーは Task 6 で解消されるため、この時点では全体は通らなくてよい）。`bunx`/`tsc` 直呼びは禁止、必ずスクリプト経由で実行する。

- [ ] **Step 3: コミット**

```bash
git add backend/src/menus/repository.ts
git commit -m "$(printf 'feat: menus の Drizzle リポジトリを追加\n\n- 期間一覧/単一取得・作成・更新・削除を実装\n- date/mealType 変更は単一 UPDATE で対応（SK 連結が不要に）\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 6: menus バリデーション共通化・ハンドラー移行・テスト更新

**Files:**
- Create: `backend/src/menus/validation.ts`
- Modify: `backend/src/menus/createMenu.ts`
- Modify: `backend/src/menus/updateMenu.ts`
- Modify: `backend/src/menus/deleteMenu.ts`
- Modify: `backend/src/menus/getMenus.ts`
- Delete: `backend/src/menus/utils.ts`
- Test: `backend/src/menus/updateMenu.test.ts`（書き換え）

**Interfaces:**
- Consumes: `listMenusInRange`/`createMenu`/`updateMenuForUser`/`deleteMenuForUser`（Task 5）
- Produces:
  - `const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'OTHER'] as const`
  - `type MealType = (typeof VALID_MEAL_TYPES)[number]`
  - `interface MenuBody { date: string; mealType: string; recipeId: string; servings: number; memo?: string | null }`
  - `validateMenuBody(body: MenuBody): HandlerResult | null`

- [ ] **Step 1: 共通バリデーションを作成**

`backend/src/menus/validation.ts`:

```ts
import { HandlerResult, badRequest } from '../shared/http';
import { isNonEmptyString, isPositiveNumber, isValidDate } from '../shared/validation';

export const VALID_MEAL_TYPES = ['BREAKFAST', 'LUNCH', 'DINNER', 'OTHER'] as const;
export type MealType = (typeof VALID_MEAL_TYPES)[number];

export interface MenuBody {
  date: string;
  mealType: string;
  recipeId: string;
  servings: number;
  memo?: string | null;
}

const isValidMealType = (mealType: string): mealType is MealType =>
  (VALID_MEAL_TYPES as readonly string[]).includes(mealType);

/**
 * POST/PUT /menus のリクエストボディを検証する。
 * 問題があれば HandlerResult（400）を、なければ null を返す。
 */
export const validateMenuBody = (body: MenuBody): HandlerResult | null => {
  if (!isNonEmptyString(body.date) || !isValidDate(body.date)) {
    return badRequest('Invalid "date" format. Use YYYY-MM-DD');
  }
  if (!isNonEmptyString(body.mealType) || !isValidMealType(body.mealType)) {
    return badRequest('Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER');
  }
  if (!isNonEmptyString(body.recipeId)) {
    return badRequest('"recipeId" is required');
  }
  if (!isPositiveNumber(body.servings)) {
    return badRequest('"servings" must be a positive number');
  }
  return null;
};
```

- [ ] **Step 2: createMenu を移行**

`backend/src/menus/createMenu.ts` を全置換:

```ts
import type { Context } from 'hono';
import { createMenu as insertMenu } from './repository';
import { MealType, MenuBody, validateMenuBody } from './validation';
import { HandlerResult, badRequest, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * POST /menus
 * 献立を1件登録する。
 */
export const createMenu = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);

    let requestBody: MenuBody;
    try {
      requestBody = await c.req.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const validationError = validateMenuBody(requestBody);
    if (validationError) {
      return validationError;
    }

    console.log(`Creating menu for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

    const menuId = await insertMenu({
      userId,
      date: requestBody.date,
      mealType: requestBody.mealType as MealType,
      recipeId: requestBody.recipeId,
      servings: requestBody.servings,
      memo: requestBody.memo ?? null,
    });

    return jsonResponse(201, { menuId });
  } catch (error) {
    console.error('Error creating menu:', error);
    return internalServerError('Failed to create menu');
  }
};
```

- [ ] **Step 3: updateMenu を移行**

`backend/src/menus/updateMenu.ts` を全置換:

```ts
import type { Context } from 'hono';
import { updateMenuForUser } from './repository';
import { MealType, MenuBody, validateMenuBody } from './validation';
import {
  HandlerResult,
  badRequest,
  internalServerError,
  jsonResponse,
  notFound,
} from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * PUT /menus/{menuId}
 * 献立を1件更新する。date/mealType の変更も単一 UPDATE で扱う。
 */
export const updateMenu = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const menuId = c.req.param('menuId');
    if (!menuId) {
      return badRequest('Menu ID is required');
    }

    let requestBody: MenuBody;
    try {
      requestBody = await c.req.json();
    } catch {
      return badRequest('Invalid JSON in request body');
    }

    const validationError = validateMenuBody(requestBody);
    if (validationError) {
      return validationError;
    }

    console.log(`Updating menu ${menuId} for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

    const updated = await updateMenuForUser(userId, menuId, {
      date: requestBody.date,
      mealType: requestBody.mealType as MealType,
      recipeId: requestBody.recipeId,
      servings: requestBody.servings,
      memo: requestBody.memo ?? null,
    });

    if (!updated) {
      return notFound('Menu not found', 'MENU_NOT_FOUND');
    }

    return jsonResponse(200, { menuId });
  } catch (error) {
    console.error('Error updating menu:', error);
    return internalServerError('Failed to update menu');
  }
};
```

- [ ] **Step 4: deleteMenu を移行**

`backend/src/menus/deleteMenu.ts` を全置換:

```ts
import type { Context } from 'hono';
import { deleteMenuForUser } from './repository';
import { HandlerResult, badRequest, internalServerError, noContent, notFound } from '../shared/http';
import { getUserId } from '../shared/auth';

const USER_ID_LOG_PREFIX_LENGTH = 12;

/**
 * DELETE /menus/{menuId}
 * 献立を1件削除する。
 */
export const deleteMenu = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);
    const menuId = c.req.param('menuId');
    if (!menuId) {
      return badRequest('Menu ID is required');
    }

    console.log(`Deleting menu ${menuId} for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}...`);

    const deleted = await deleteMenuForUser(userId, menuId);
    if (!deleted) {
      return notFound('Menu not found', 'MENU_NOT_FOUND');
    }

    return noContent();
  } catch (error) {
    console.error('Error deleting menu:', error);
    return internalServerError('Failed to delete menu');
  }
};
```

- [ ] **Step 5: getMenus を移行**

`backend/src/menus/getMenus.ts` を全置換:

```ts
import type { Context } from 'hono';
import { listMenusInRange } from './repository';
import { HandlerResult, badRequest, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';
import { isValidDate } from '../shared/validation';

const DEFAULT_PERIOD_DAYS = 7;
const USER_ID_LOG_PREFIX_LENGTH = 12;

const getDefaultDateRange = (): { from: string; to: string } => {
  const today = new Date();
  const toDate = new Date(today);
  toDate.setDate(today.getDate() + DEFAULT_PERIOD_DAYS - 1);
  const formatDate = (d: Date): string => d.toISOString().split('T')[0];
  return { from: formatDate(today), to: formatDate(toDate) };
};

interface MenuItemResponse {
  date: string;
  mealType: string;
  menuId: string;
  recipeId: string;
  servings: number;
}

/**
 * GET /menus
 * 指定期間（デフォルトは今日から7日）の献立一覧を返す。
 */
export const getMenus = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);

    const defaults = getDefaultDateRange();
    const from = c.req.query('from') ?? defaults.from;
    const to = c.req.query('to') ?? defaults.to;

    if (!isValidDate(from)) {
      return badRequest('Invalid "from" date format. Use YYYY-MM-DD');
    }
    if (!isValidDate(to)) {
      return badRequest('Invalid "to" date format. Use YYYY-MM-DD');
    }
    if (from > to) {
      return badRequest('"from" date must not be after "to" date');
    }

    console.log(
      `Fetching menus for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}..., from: ${from}, to: ${to}`
    );

    const menus = await listMenusInRange(userId, from, to);

    const items: MenuItemResponse[] = menus.map(menu => ({
      date: menu.date,
      mealType: menu.mealType,
      menuId: menu.menuId,
      recipeId: menu.recipeId,
      servings: menu.servings,
    }));

    return jsonResponse(200, { from, to, items });
  } catch (error) {
    console.error('Error fetching menus:', error);
    return internalServerError('Failed to fetch menus');
  }
};
```

- [ ] **Step 6: utils.ts を削除**

```bash
git rm backend/src/menus/utils.ts
```

（`findMenuByMenuId` と `MenuItemWithSK` は menus リポジトリに置き換え済み。`createMenu.ts` 旧実装が import していた `MenuItemWithSK` は新実装で未使用。）

- [ ] **Step 7: updateMenu.test.ts を書き換え（リポジトリをモック）**

`backend/src/menus/updateMenu.test.ts` を全置換:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { updateMenuForUserMock } = vi.hoisted(() => ({
  updateMenuForUserMock: vi.fn(),
}));

vi.mock('./repository', () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: updateMenuForUserMock,
  deleteMenuForUser: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  getUserId: () => 'user-123',
}));

import app from '../app';

const putMenu = (body: unknown): Promise<Response> =>
  app.request('/menus/menu-123', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('PUT /menus/:menuId', () => {
  beforeEach(() => {
    updateMenuForUserMock.mockReset();
  });

  it('更新に成功すると 200 と menuId を返す', async () => {
    updateMenuForUserMock.mockResolvedValue(true);

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 3,
      memo: '作り置き',
    });

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ menuId: 'menu-123' });
    expect(updateMenuForUserMock).toHaveBeenCalledWith('user-123', 'menu-123', {
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 3,
      memo: '作り置き',
    });
  });

  it('対象が見つからない場合は 404 を返す', async () => {
    updateMenuForUserMock.mockResolvedValue(false);

    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'LUNCH',
      recipeId: 'recipe-new',
      servings: 2,
    });

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: { code: 'MENU_NOT_FOUND', message: 'Menu not found', details: null },
    });
  });

  it('servings が不正な場合は 400 を返し、リポジトリを呼ばない', async () => {
    const response = await putMenu({
      date: '2026-05-21',
      mealType: 'DINNER',
      recipeId: 'recipe-new',
      servings: 0,
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'BAD_REQUEST', message: '"servings" must be a positive number', details: null },
    });
    expect(updateMenuForUserMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 8: menus のテストを実行**

```bash
cd backend && bun run test -- menus && cd ..
```

Expected: PASS（3 ケース）。

- [ ] **Step 9: コミット**

```bash
git add backend/src/menus/
git commit -m "$(printf 'refactor: menus ハンドラーを Drizzle リポジトリ経由に移行\n\n- DynamoDB SDK 呼び出しと SK 連結ロジックを撤去\n- mealType/日付バリデーションを validation.ts に共通化し utils.ts を削除\n- テストをリポジトリモックへ更新\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 7: shopping list ハンドラー移行・テスト更新

**Files:**
- Modify: `backend/src/shoppingList/getShoppingList.ts`
- Test: `backend/src/shoppingList/getShoppingList.test.ts`（書き換え）

**Interfaces:**
- Consumes: `listMenusInRange`（Task 5）, `findRecipeWithIngredients` / `RecipeWithIngredients`（Task 3）

- [ ] **Step 1: getShoppingList を移行**

`backend/src/shoppingList/getShoppingList.ts` を全置換:

```ts
import type { Context } from 'hono';
import { listMenusInRange } from '../menus/repository';
import { findRecipeWithIngredients, RecipeWithIngredients } from '../recipes/repository';
import { HandlerResult, badRequest, internalServerError, jsonResponse } from '../shared/http';
import { getUserId } from '../shared/auth';
import { isNonEmptyString, isValidDate } from '../shared/validation';

const USER_ID_LOG_PREFIX_LENGTH = 12;

type ShoppingListItem = {
  ingredientName: string;
  totalQuantity: number | string;
  unit: string;
};

const roundQuantity = (value: number): number => Math.round(value * 1_000_000) / 1_000_000;

const buildAggregationKey = (ingredientName: string, unit: string): string =>
  `${ingredientName} ${unit}`;

type AggregatedItem = {
  ingredientName: string;
  unit: string;
  totalNumeric: number;
  textQuantities: Set<string>;
};

const formatTotalQuantity = (aggregate: AggregatedItem): number | string => {
  const hasNumeric = aggregate.totalNumeric !== 0;
  const texts = [...aggregate.textQuantities].filter(Boolean).sort();
  const hasText = texts.length > 0;

  if (hasText && !hasNumeric) {
    return texts.join(' + ');
  }
  if (!hasText) {
    return roundQuantity(aggregate.totalNumeric);
  }
  return `${roundQuantity(aggregate.totalNumeric)} + ${texts.join(' + ')}`;
};

/**
 * GET /shopping-list?from&to
 * 指定期間の献立から必要な材料を集計して返す。
 *
 * 集計ルール:
 * - quantity が number の材料は servings / baseServings でスケーリングして合算。
 * - quantity が string の材料はスケーリングせず、同一キー内で ` + ` 連結（重複除外）。
 * - number と string が混在する場合は "<number> + <string>" 文字列で返す。
 */
export const getShoppingList = async (c: Context): Promise<HandlerResult> => {
  try {
    const userId = getUserId(c);

    const from = c.req.query('from');
    const to = c.req.query('to');

    if (!isNonEmptyString(from)) {
      return badRequest('"from" query parameter is required');
    }
    if (!isNonEmptyString(to)) {
      return badRequest('"to" query parameter is required');
    }
    if (!isValidDate(from)) {
      return badRequest('Invalid "from" date format. Use YYYY-MM-DD');
    }
    if (!isValidDate(to)) {
      return badRequest('Invalid "to" date format. Use YYYY-MM-DD');
    }
    if (from > to) {
      return badRequest('"from" date must not be after "to" date');
    }

    console.log(
      `Computing shopping list for userId: ${userId.substring(0, USER_ID_LOG_PREFIX_LENGTH)}..., from: ${from}, to: ${to}`
    );

    const menus = await listMenusInRange(userId, from, to);

    const recipeCache = new Map<string, RecipeWithIngredients | null>();
    const aggregated = new Map<string, AggregatedItem>();

    for (const menu of menus) {
      const recipeId = menu.recipeId;

      let data = recipeCache.get(recipeId);
      if (data === undefined) {
        data = await findRecipeWithIngredients(userId, recipeId);
        recipeCache.set(recipeId, data);
      }

      if (!data) {
        console.error('Recipe referenced by menu was not found', { recipeId, menuId: menu.menuId });
        return internalServerError('Failed to compute shopping list');
      }

      const { recipe, ingredients } = data;
      if (typeof recipe.baseServings !== 'number' || recipe.baseServings <= 0) {
        console.error('Invalid baseServings on recipe', { recipeId, baseServings: recipe.baseServings });
        return internalServerError('Failed to compute shopping list');
      }

      const scale = menu.servings / recipe.baseServings;

      for (const ingredient of ingredients) {
        const key = buildAggregationKey(ingredient.ingredientName, ingredient.unit);
        let current = aggregated.get(key);
        if (!current) {
          current = {
            ingredientName: ingredient.ingredientName,
            unit: ingredient.unit,
            totalNumeric: 0,
            textQuantities: new Set<string>(),
          };
          aggregated.set(key, current);
        }

        if (typeof ingredient.quantity === 'number' && Number.isFinite(ingredient.quantity)) {
          current.totalNumeric += ingredient.quantity * scale;
          continue;
        }
        if (typeof ingredient.quantity === 'string') {
          const trimmed = ingredient.quantity.trim();
          if (trimmed.length > 0) {
            current.textQuantities.add(trimmed);
          }
        }
      }
    }

    const items: ShoppingListItem[] = [...aggregated.values()]
      .map(aggregate => ({
        ingredientName: aggregate.ingredientName,
        totalQuantity: formatTotalQuantity(aggregate),
        unit: aggregate.unit,
      }))
      .sort((a, b) =>
        a.ingredientName === b.ingredientName
          ? a.unit.localeCompare(b.unit)
          : a.ingredientName.localeCompare(b.ingredientName)
      );

    return jsonResponse(200, { from, to, items });
  } catch (error) {
    console.error('Error computing shopping list:', error);
    return internalServerError('Failed to compute shopping list');
  }
};
```

- [ ] **Step 2: getShoppingList.test.ts を書き換え（両リポジトリをモック）**

`backend/src/shoppingList/getShoppingList.test.ts` を全置換:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { listMenusInRangeMock, findRecipeWithIngredientsMock } = vi.hoisted(() => ({
  listMenusInRangeMock: vi.fn(),
  findRecipeWithIngredientsMock: vi.fn(),
}));

vi.mock('../menus/repository', () => ({
  listMenusInRange: listMenusInRangeMock,
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: vi.fn(),
}));

vi.mock('../recipes/repository', () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: findRecipeWithIngredientsMock,
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  getUserId: () => 'user-123',
}));

import app from '../app';

const getShoppingListRequest = (from: string, to: string): Promise<Response> =>
  app.request(`/shopping-list?from=${from}&to=${to}`);

const menu = (menuId: string, date: string, recipeId: string, servings: number) => ({
  menuId,
  userId: 'user-123',
  date,
  mealType: 'DINNER' as const,
  recipeId,
  servings,
  createdAt: '2026-05-20T00:00:00.000Z',
  updatedAt: '2026-05-20T00:00:00.000Z',
});

describe('GET /shopping-list', () => {
  beforeEach(() => {
    listMenusInRangeMock.mockReset();
    findRecipeWithIngredientsMock.mockReset();
  });

  it('人数換算しながら材料を集計し、文字列数量は重複排除する', async () => {
    listMenusInRangeMock.mockResolvedValue([
      menu('menu-1', '2026-05-22', 'recipe-1', 1),
      menu('menu-2', '2026-05-23', 'recipe-1', 3),
      menu('menu-3', '2026-05-24', 'recipe-2', 1),
    ]);

    findRecipeWithIngredientsMock.mockImplementation(async (_userId: string, recipeId: string) => {
      if (recipeId === 'recipe-1') {
        return {
          recipe: {
            recipeId: 'recipe-1',
            userId: 'user-123',
            name: 'カレー',
            baseServings: 2,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          ingredients: [
            { recipeId: 'recipe-1', ingredientName: '玉ねぎ', quantity: 1, unit: '個' },
            { recipeId: 'recipe-1', ingredientName: '塩', quantity: '少々', unit: '適量' },
          ],
        };
      }
      if (recipeId === 'recipe-2') {
        return {
          recipe: {
            recipeId: 'recipe-2',
            userId: 'user-123',
            name: 'サラダ',
            baseServings: 1,
            createdAt: '2026-05-20T00:00:00.000Z',
            updatedAt: '2026-05-20T00:00:00.000Z',
          },
          ingredients: [
            { recipeId: 'recipe-2', ingredientName: '玉ねぎ', quantity: 0.5, unit: '個' },
            { recipeId: 'recipe-2', ingredientName: '塩', quantity: '少々', unit: '適量' },
            { recipeId: 'recipe-2', ingredientName: 'こしょう', quantity: '適量', unit: '適量' },
          ],
        };
      }
      return null;
    });

    const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      from: string;
      to: string;
      items: Array<{ ingredientName: string; totalQuantity: number | string; unit: string }>;
    };
    expect(body.from).toBe('2026-05-22');
    expect(body.to).toBe('2026-05-24');
    expect(body.items).toEqual(
      expect.arrayContaining([
        { ingredientName: '玉ねぎ', totalQuantity: 2.5, unit: '個' },
        { ingredientName: '塩', totalQuantity: '少々', unit: '適量' },
        { ingredientName: 'こしょう', totalQuantity: '適量', unit: '適量' },
      ])
    );
    expect(body.items).toHaveLength(3);
    expect(listMenusInRangeMock).toHaveBeenCalledWith('user-123', '2026-05-22', '2026-05-24');
  });

  it('from が to より後なら 400 を返す', async () => {
    const response = await getShoppingListRequest('2026-05-25', '2026-05-24');

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'BAD_REQUEST', message: '"from" date must not be after "to" date', details: null },
    });
    expect(listMenusInRangeMock).not.toHaveBeenCalled();
  });

  it('献立が参照するレシピが見つからない場合は 500 を返す', async () => {
    listMenusInRangeMock.mockResolvedValue([menu('menu-1', '2026-05-22', 'recipe-missing', 2)]);
    findRecipeWithIngredientsMock.mockResolvedValue(null);

    const response = await getShoppingListRequest('2026-05-22', '2026-05-22');

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Failed to compute shopping list', details: null },
    });
  });
});
```

- [ ] **Step 3: shopping list のテストを実行**

```bash
cd backend && bun run test -- shoppingList && cd ..
```

Expected: PASS（3 ケース）。

- [ ] **Step 4: コミット**

```bash
git add backend/src/shoppingList/
git commit -m "$(printf 'refactor: shopping-list を Drizzle リポジトリ経由に移行\n\n- 献立・レシピ・材料の取得をリポジトリ呼び出しに置換\n- 集計ロジックとレスポンス形式は不変\n- テストをリポジトリモックへ更新\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

---

### Task 8: 後始末・ドキュメント更新・全体検証・PR

**Files:**
- Delete: `backend/src/shared/dynamodb.ts`
- Modify: `backend/AGENTS.md`
- Modify: `backend/IMPLEMENTATION_NOTES.md`（DB 記述があれば更新。なければスキップ可）

- [ ] **Step 1: dynamodb.ts を削除**

```bash
git rm backend/src/shared/dynamodb.ts
```

- [ ] **Step 2: AWS SDK 残存参照がないことを確認**

```bash
cd backend && grep -rn "aws-sdk\|dynamodb\|DynamoDB\|TABLE_NAMES" src && cd ..
```

Expected: 一致なし（出力が空）。一致があればその箇所を修正してから次へ。

- [ ] **Step 3: backend/AGENTS.md の DB 関連ルールを更新**

`backend/AGENTS.md` の以下の行を置き換える。

置換前（DynamoDB 前提の3行）:

```
- DynamoDB との通信は AWS SDK v3（`@aws-sdk/lib-dynamodb`）を使ってください（DB 層の移行は別 Issue）。
- DynamoDB 操作では `userId` を条件に含めてください。
```
と
```
- Lambda 固有の SDK（`@aws-sdk/client-lambda` 等）を新たに追加しないでください。
```

置換後:

```
- DB アクセスは Drizzle ORM（`drizzle-orm/postgres-js`）で行い、ドメインごとの `repository.ts`（`recipes/` `menus/`）に集約してください。ハンドラーから直接 SQL/クライアントを呼ばないでください。
- スキーマ定義は `src/shared/schema.ts`、接続は `src/shared/db.ts`（`DATABASE_URL`）です。
- `recipes` / `menus` のクエリは必ず `user_id` でスコープしてください。`recipe_ingredients` は `recipe_id` 経由でユーザーコンテキストを継承します（独自の userId カラムは持ちません）。
- API 上の `recipeId` / `menuId` は DB の `id` 列、`quantity` は `quantity_value` / `quantity_text` に対応します。変換はリポジトリ層に閉じてください。
- AWS SDK（`@aws-sdk/*`）を新たに追加しないでください。
- スキーマ変更時は `bun run db:generate` でマイグレーションを生成し、`docs/03-domain-and-data-model.md` も更新してください。
```

また「よく使うコマンド」に追記:

```
- `bun run db:generate` / `bun run db:migrate`
```

- [ ] **Step 4: IMPLEMENTATION_NOTES.md を確認・更新**

`backend/IMPLEMENTATION_NOTES.md` を開き、DynamoDB に言及する記述があれば PostgreSQL/Drizzle 前提に更新する。DB に関する記述がなければ変更不要。

- [ ] **Step 5: バックエンド全体の型チェック・lint・テスト**

```bash
bun run backend:type-check
bun run backend:lint
bun run backend:test
```

Expected: いずれもエラーなし。テストは全ファイル（quantity / recipes / menus / shoppingList / app）が PASS。

- [ ] **Step 6: リポジトリ全体の検証（PR 前チェック）**

```bash
bun run lint && bun run format:check && bun run type-check && bun run build:all
```

Expected: すべて成功。`format:check` で差分が出たら `bun run backend:format` を実行して再確認・コミットに含める。

- [ ] **Step 7: ローカル PostgreSQL でのスモークテスト（受け入れ条件 1〜3）**

> 実 DB を使う手動確認。`DATABASE_URL` を設定した `backend/.env` を用意し、空の DB（例: `cooking_planner`）を作成しておく。

```bash
# 1) マイグレーションでテーブル作成（受け入れ条件①）
cd backend && bun run db:migrate && cd ..
```
Expected: `recipes` / `recipe_ingredients` / `menus` テーブルが作成される（`psql` で `\dt` を確認）。

```bash
# 2) サーバー起動（別ターミナル / バックグラウンド）
bun run backend:dev
```

```bash
# 3) レシピ CRUD（受け入れ条件②）
curl -s -X POST localhost:3000/recipes -H 'Content-Type: application/json' \
  -d '{"name":"カレー","baseServings":2,"ingredients":[{"ingredientName":"玉ねぎ","quantity":1,"unit":"個"},{"ingredientName":"塩","quantity":"少々","unit":"適量"}]}'
# → {"recipeId":"..."} を控える
curl -s localhost:3000/recipes
curl -s localhost:3000/recipes/<recipeId>          # 材料含む詳細
curl -s -X PUT localhost:3000/recipes/<recipeId> -H 'Content-Type: application/json' \
  -d '{"name":"カレー改","baseServings":2,"ingredients":[{"ingredientName":"玉ねぎ","quantity":2,"unit":"個"}]}'

# 4) 献立 + 買い物リスト（受け入れ条件③）
curl -s -X POST localhost:3000/menus -H 'Content-Type: application/json' \
  -d '{"date":"2026-06-25","mealType":"DINNER","recipeId":"<recipeId>","servings":4}'
curl -s "localhost:3000/menus?from=2026-06-25&to=2026-06-25"
curl -s "localhost:3000/shopping-list?from=2026-06-25&to=2026-06-25"
# → 玉ねぎが servings(4)/baseServings(2)=2 倍でスケーリングされること
curl -s -X DELETE -i localhost:3000/menus/<menuId>   # 204
```

Expected: 各レスポンスが `docs/04-api-design.md` の形式どおり。買い物リストの数量がスケーリングされる。問題があれば原因のタスクに戻って修正。

- [ ] **Step 8: 残りの変更をコミット**

```bash
git add backend/AGENTS.md backend/IMPLEMENTATION_NOTES.md backend/src/shared/dynamodb.ts
git add -A backend
git commit -m "$(printf 'chore: DynamoDB 依存を撤去し backend ドキュメントを更新\n\n- shared/dynamodb.ts を削除\n- AGENTS.md の DB ルールを Drizzle/PostgreSQL 前提に更新\n\nCo-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>')"
```

- [ ] **Step 9: プッシュして PR を作成**

```bash
git push -u origin feature/128-migrate-datastore-to-postgresql-drizzle
```

PR は `.github/PULL_REQUEST_TEMPLATE.md` に従い、タイトルは Issue #128 と同じ「データストアをPostgreSQL + Drizzle ORMに移行（DynamoDB廃止）」、「関連Issue/タスク」欄に `closes #128`、`--label enhancement` を付けて作成する。

```bash
gh pr create --base main --label enhancement --title "データストアをPostgreSQL + Drizzle ORMに移行（DynamoDB廃止）" --body "<テンプレートに従って記載／closes #128>"
```

---

## Self-Review（計画作成者によるチェック結果）

**1. Spec coverage:**
- スキーマ定義 → Task 1（schema.ts）/ 初期マイグレーション → Task 1 Step 8。
- Drizzle 導入・AWS SDK 削除・DATABASE_URL → Task 1。
- recipes CRUD → Task 3/4。menus + 買い物リスト → Task 5/6/7。
- 型チェック・lint → Task 8 Step 5–6。
- テストの PostgreSQL（リポジトリモック）対応 → Task 4/6/7。
- 受け入れ条件①②③ → Task 8 Step 7 のスモークテスト。
- API レスポンス不変・PG 固有依存回避 → スキーマ（varchar+CHECK）とマッピング層（Task 1/2/3/5）。

**2. Placeholder scan:** "TBD"/"後で実装" 等なし。各コード Step に完全なコードを記載。

**3. Type consistency:** リポジトリの公開シグネチャ（`createRecipeWithIngredients`/`replaceRecipeWithIngredients`/`findRecipeWithIngredients`/`listRecipesByUser`、`createMenu`/`updateMenuForUser`/`deleteMenuForUser`/`listMenusInRange`/`findMenuByIdForUser`）はハンドラー・テストの呼び出しと一致。`RecipeWithIngredients` / `NewRecipeInput` / `NewIngredientInput` / `NewMenuInput` / `MealType` / `RecipeBody` / `MenuBody` は定義タスクと利用タスクで整合。

**既知のトレードオフ:** リポジトリ層自体の自動テストは行わず（方針どおりモック）、実 DB 検証は Task 8 Step 7 の手動スモークテストで担保する。recipeId/menuId に UUID 形式でない値が渡された場合、Postgres 側で 500 になり得る（旧実装は 404）。個人用途のエッジケースとして許容。
