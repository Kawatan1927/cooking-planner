# Shopping List API単体テスト拡充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shopping List APIの必須期間、日付検証、空結果、材料集計、ユーザー境界、repository例外時の既存契約を `app.request` 経由の単体テストで保護する。

**Architecture:** 既存の `getShoppingList.test.ts` を拡充し、Honoのルーティング・handler・response変換は実コードを使用する。認証は固定ユーザー、MenusとRecipesのrepositoryはDB境界としてmockし、HTTPレスポンスとhandlerから渡される引数を検証する。本番コードは変更しない。

**Tech Stack:** Bun、TypeScript、Hono、Vitest

## Global Constraints

- 本番コード、repository、API仕様を変更しない。
- 実PostgreSQLを使用する統合テストは追加しない。
- 材料名の表記ゆれ補正、単位変換、買い物リスト仕様の変更は行わない。
- テストは `app.request` 経由で実行し、実装内部の集計用関数を直接テストしない。
- repository mockはDBアクセスを隔離するためだけに使い、mock自身の動作をテストしない。
- `.serena/project.yml` の既存変更をステージしない。
- 仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- 追加テストが仕様と本番コードの差異を検出した場合は、期待値を弱めず、本番コードを変更する前にユーザーへ確認する。

---

## ファイル構成

- Modify: `backend/src/shoppingList/getShoppingList.test.ts`
  - query検証、空結果、repository引数、材料集計、repository例外を検証する。
- Verify: `backend/src/shoppingList/getShoppingList.ts`
  - テスト対象。変更しない。
- Verify: `docs/superpowers/specs/2026-07-27-shopping-list-api-tests-design.md`
  - 承認済みのテスト設計。変更しない。
- Create: `docs/superpowers/plans/2026-07-27-shopping-list-api-tests.md`
  - 本実装計画。

### Task 1: 型付きmockとquery検証

**Files:**

- Modify: `backend/src/shoppingList/getShoppingList.test.ts`

**Interfaces:**

- Consumes: `app.request(path: string)`、`listMenusInRange(userId: string, from: string, to: string): Promise<Menu[]>`、`findRecipeWithIngredients(userId: string, recipeId: string): Promise<RecipeWithIngredients | null>`
- Produces: 必須query、日付形式、実在日付、期間前後関係の400契約とrepository非呼び出しを固定するテスト

- [ ] **Step 1: 現在の対象テストを実行して基準を記録する**

Run:

```bash
cd backend
bun run test -- src/shoppingList/getShoppingList.test.ts
```

Expected: 既存3ケースがPASSする。件数とexit codeを記録し、以降の追加で既存ケースが減っていないことを確認する。

- [ ] **Step 2: repository mockを実関数の型へ追従させる**

`backend/src/shoppingList/getShoppingList.test.ts` のimportとhoisted mockを次の形へ変更する。

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { listMenusInRange } from '../menus/repository';
import type { findRecipeWithIngredients } from '../recipes/repository';

const { listMenusInRangeMock, findRecipeWithIngredientsMock } = vi.hoisted(() => ({
  listMenusInRangeMock: vi.fn<typeof listMenusInRange>(),
  findRecipeWithIngredientsMock: vi.fn<typeof findRecipeWithIngredients>(),
}));
```

`describe` の後処理としてspyを確実に復元する。

```typescript
afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 3: query不正のテーブル駆動テストを追加する**

既存の `from が to より後なら 400 を返す` を次のテーブル駆動テストへ置き換える。

```typescript
it.each([
  {
    caseName: 'fromが未指定',
    path: '/api/shopping-list?to=2026-05-24',
    message: '"from" query parameter is required',
  },
  {
    caseName: 'toが未指定',
    path: '/api/shopping-list?from=2026-05-22',
    message: '"to" query parameter is required',
  },
  {
    caseName: 'fromの形式が不正',
    path: '/api/shopping-list?from=2026-5-22&to=2026-05-24',
    message: 'Invalid "from" date format. Use YYYY-MM-DD',
  },
  {
    caseName: 'toの形式が不正',
    path: '/api/shopping-list?from=2026-05-22&to=2026/05/24',
    message: 'Invalid "to" date format. Use YYYY-MM-DD',
  },
  {
    caseName: 'fromが実在しない日付',
    path: '/api/shopping-list?from=2026-02-30&to=2026-03-01',
    message: 'Invalid "from" date format. Use YYYY-MM-DD',
  },
  {
    caseName: 'toが実在しない日付',
    path: '/api/shopping-list?from=2026-02-01&to=2026-02-30',
    message: 'Invalid "to" date format. Use YYYY-MM-DD',
  },
  {
    caseName: 'fromがtoより後',
    path: '/api/shopping-list?from=2026-05-25&to=2026-05-24',
    message: '"from" date must not be after "to" date',
  },
])('$caseNameの場合は400を返しrepositoryを呼ばない', async ({ path, message }) => {
  const response = await app.request(path);

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: { code: 'BAD_REQUEST', message, details: null },
  });
  expect(listMenusInRangeMock).not.toHaveBeenCalled();
  expect(findRecipeWithIngredientsMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: query検証テストを実行する**

Run:

```bash
cd backend
bun run test -- src/shoppingList/getShoppingList.test.ts
```

Expected: 既存実装が仕様どおりなら全ケースがPASSする。FAILした場合は `isValidDate` とhandlerの検証順序を確認し、期待値だけを変更しない。

- [ ] **Step 5: query検証をコミットする**

```bash
git add -- backend/src/shoppingList/getShoppingList.test.ts
git commit -m "test: Shopping Listの期間検証を拡充" -m "- 必須queryと日付不正時の400を検証
- 不正入力時にrepositoryを呼ばないことを検証"
```

### Task 2: 空結果と認証済みユーザー境界

**Files:**

- Modify: `backend/src/shoppingList/getShoppingList.test.ts`

**Interfaces:**

- Consumes: Task 1の型付きmock、`getShoppingListRequest(from: string, to: string): Promise<Response>`
- Produces: 献立0件の200応答、Menus repositoryとRecipes repositoryへ渡す認証済みuserIdを固定するテスト

- [ ] **Step 1: 献立0件のテストを追加する**

```typescript
it('献立が0件の場合は空の買い物リストを返す', async () => {
  listMenusInRangeMock.mockResolvedValue([]);

  const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    from: '2026-05-22',
    to: '2026-05-24',
    items: [],
  });
  expect(listMenusInRangeMock).toHaveBeenCalledWith(
    'user-123',
    '2026-05-22',
    '2026-05-24'
  );
  expect(findRecipeWithIngredientsMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 既存の人数換算テストへRecipes repositoryのuserId検証を追加する**

既存の正常系テストの末尾へ次を追加する。

```typescript
expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-1');
expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-2');
expect(findRecipeWithIngredientsMock).toHaveBeenCalledTimes(2);
```

同じ `recipe-1` を参照する献立が2件あっても、リクエスト内キャッシュにより取得が1回であることを総呼び出し回数で確認する。

- [ ] **Step 3: 空結果とユーザー境界のテストを実行する**

Run:

```bash
cd backend
bun run test -- src/shoppingList/getShoppingList.test.ts
```

Expected: 全ケースがPASSし、空結果ではRecipes repositoryが呼ばれず、正常系では固定ユーザー `user-123` が両repositoryへ渡る。

- [ ] **Step 4: 空結果とユーザー境界をコミットする**

```bash
git add -- backend/src/shoppingList/getShoppingList.test.ts
git commit -m "test: Shopping Listのユーザー境界を検証" -m "- 献立0件の空レスポンスを検証
- MenusとRecipesのrepository引数を検証
- 同一レシピの取得キャッシュを検証"
```

### Task 3: 単位分離・文字列混在・小数倍率の材料集計

**Files:**

- Modify: `backend/src/shoppingList/getShoppingList.test.ts`

**Interfaces:**

- Consumes: `menu(menuId: string, date: string, recipeId: string, servings: number)`、型付きrepository mock
- Produces: 複数献立・複数レシピにおける数値合算、単位分離、数値と文字列の混在、小数倍率、レシピ取得キャッシュを固定するテスト

- [ ] **Step 1: 複数献立・複数レシピの集計テストを追加する**

```typescript
it('複数献立を小数倍率で集計し、単位と文字列quantityを区別する', async () => {
  listMenusInRangeMock.mockResolvedValue([
    menu('menu-1', '2026-05-22', 'recipe-1', 1),
    menu('menu-2', '2026-05-23', 'recipe-1', 2),
    menu('menu-3', '2026-05-24', 'recipe-2', 1),
  ]);

  findRecipeWithIngredientsMock.mockImplementation(async (_userId, recipeId) => {
    if (recipeId === 'recipe-1') {
      return {
        recipe: {
          recipeId: 'recipe-1',
          userId: 'user-123',
          name: 'Recipe 1',
          baseServings: 2,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        },
        ingredients: [
          { recipeId: 'recipe-1', ingredientName: 'Flour', quantity: 2, unit: 'g' },
          { recipeId: 'recipe-1', ingredientName: 'Salt', quantity: 2, unit: 'g' },
        ],
      };
    }
    if (recipeId === 'recipe-2') {
      return {
        recipe: {
          recipeId: 'recipe-2',
          userId: 'user-123',
          name: 'Recipe 2',
          baseServings: 4,
          createdAt: '2026-05-20T00:00:00.000Z',
          updatedAt: '2026-05-20T00:00:00.000Z',
        },
        ingredients: [
          { recipeId: 'recipe-2', ingredientName: 'Flour', quantity: 4, unit: 'g' },
          { recipeId: 'recipe-2', ingredientName: 'Flour', quantity: 1, unit: 'kg' },
          { recipeId: 'recipe-2', ingredientName: 'Salt', quantity: '適量', unit: 'g' },
        ],
      };
    }
    return null;
  });

  const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    from: '2026-05-22',
    to: '2026-05-24',
    items: [
      { ingredientName: 'Flour', totalQuantity: 4, unit: 'g' },
      { ingredientName: 'Flour', totalQuantity: 0.25, unit: 'kg' },
      { ingredientName: 'Salt', totalQuantity: '3 + 適量', unit: 'g' },
    ],
  });
  expect(findRecipeWithIngredientsMock).toHaveBeenCalledTimes(2);
  expect(findRecipeWithIngredientsMock).toHaveBeenNthCalledWith(1, 'user-123', 'recipe-1');
  expect(findRecipeWithIngredientsMock).toHaveBeenNthCalledWith(2, 'user-123', 'recipe-2');
});
```

このデータでは、Recipe 1の倍率 `0.5` と `1`、Recipe 2の倍率 `0.25` を使う。`Flour/g` は `1 + 2 + 1 = 4`、`Flour/kg` は `0.25`、`Salt/g` は数値 `1 + 2 = 3` と文字列 `適量` を混在させる。

- [ ] **Step 2: 材料集計テストを実行する**

Run:

```bash
cd backend
bun run test -- src/shoppingList/getShoppingList.test.ts
```

Expected: 全ケースがPASSし、itemsの数・並び順・合計値・単位分離・文字列混在が一致する。FAILした場合はIssue #154と承認済み設計を基準に差異を報告し、本番コードを変更しない。

- [ ] **Step 3: 材料集計をコミットする**

```bash
git add -- backend/src/shoppingList/getShoppingList.test.ts
git commit -m "test: Shopping Listの材料集計を拡充" -m "- 小数倍率を含む複数献立の数値合算を検証
- 同名材料の単位分離を検証
- 数値quantityと文字列quantityの混在規則を検証"
```

### Task 4: repository例外のエラー契約

**Files:**

- Modify: `backend/src/shoppingList/getShoppingList.test.ts`

**Interfaces:**

- Consumes: Task 1の `afterEach`、型付きrepository mock、`getShoppingListRequest`
- Produces: MenusとRecipesのrepository例外を同じ500応答へ変換する既存契約を固定するテスト

- [ ] **Step 1: Menus repository例外のテストを追加する**

```typescript
it('献立repository例外時は500を返す', async () => {
  listMenusInRangeMock.mockRejectedValue(new Error('database error'));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  const response = await getShoppingListRequest('2026-05-22', '2026-05-24');

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to compute shopping list',
      details: null,
    },
  });
  expect(findRecipeWithIngredientsMock).not.toHaveBeenCalled();
  expect(consoleError).toHaveBeenCalled();
});
```

- [ ] **Step 2: Recipes repository例外のテストを追加する**

```typescript
it('レシピrepository例外時は500を返す', async () => {
  listMenusInRangeMock.mockResolvedValue([
    menu('menu-1', '2026-05-22', 'recipe-1', 2),
  ]);
  findRecipeWithIngredientsMock.mockRejectedValue(new Error('database error'));
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

  const response = await getShoppingListRequest('2026-05-22', '2026-05-22');

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Failed to compute shopping list',
      details: null,
    },
  });
  expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith('user-123', 'recipe-1');
  expect(consoleError).toHaveBeenCalled();
});
```

- [ ] **Step 3: 既存の参照レシピなしケースへrepository引数を追加する**

既存の `献立が参照するレシピが見つからない場合は 500 を返す` の末尾へ次を追加する。

```typescript
expect(findRecipeWithIngredientsMock).toHaveBeenCalledWith(
  'user-123',
  'recipe-missing'
);
```

- [ ] **Step 4: エラー契約テストを実行する**

Run:

```bash
cd backend
bun run test -- src/shoppingList/getShoppingList.test.ts
```

Expected: 全ケースがPASSし、例外と `null` のどちらも既存の500 bodyへ変換される。想定した `console.error` は各テスト終了後に復元される。

- [ ] **Step 5: エラー契約をコミットする**

```bash
git add -- backend/src/shoppingList/getShoppingList.test.ts
git commit -m "test: Shopping Listの例外応答を検証" -m "- MenusとRecipesのrepository例外時の500を検証
- 参照レシピなしのrepository引数を検証"
```

### Task 5: 全体検証と公開準備

**Files:**

- Verify: `backend/src/shoppingList/getShoppingList.test.ts`
- Verify: `backend/src/shoppingList/getShoppingList.ts`
- Verify: `docs/superpowers/specs/2026-07-27-shopping-list-api-tests-design.md`
- Verify: `docs/superpowers/plans/2026-07-27-shopping-list-api-tests.md`

**Interfaces:**

- Consumes: Tasks 1〜4のコミット済み成果物
- Produces: Issue #154の受け入れ条件を満たす検証証跡とPR作成可能なブランチ

- [ ] **Step 1: Shopping List対象テストを実行する**

Run:

```bash
cd backend
bun run test -- src/shoppingList/getShoppingList.test.ts
```

Expected: `getShoppingList.test.ts` の既存3ケースを維持したうえで、追加した全ケースがPASSする。

- [ ] **Step 2: backend全テストを実行する**

Run:

```bash
cd backend
bun run test
```

Expected: backendの全テストファイルがPASSする。

- [ ] **Step 3: PR作成前の共通検証を順番に実行する**

Run:

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
git diff --check
```

Expected: すべてexit code 0。重いBun検証は並列実行せず、各コマンドの成否を個別に確認する。

- [ ] **Step 4: 差分とコミット対象を確認する**

Run:

```bash
git status --short
git diff --stat main...HEAD
git diff --name-only main...HEAD
git log --oneline main..HEAD
```

Expected: `.serena/project.yml` は未ステージのままで、Issue #154に関係するspec、plan、Shopping Listテストだけがコミットされている。本番コードと仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` に差分がない。

- [ ] **Step 5: pushとPR作成へ引き渡す**

ブランチ `feature/154-expand-shopping-list-api-tests` をpushする。PRタイトルはIssueと同じ `Shopping List APIの単体テストを拡充する`、labelは `enhancement`、PR本文は `.github/PULL_REQUEST_TEMPLATE.md` に従い、`関連Issue/タスク` に `closes #154` を記載する。
