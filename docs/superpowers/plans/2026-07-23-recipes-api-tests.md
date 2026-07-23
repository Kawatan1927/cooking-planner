# Recipes API単体テスト拡充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recipes APIのGET一覧・GET詳細・POST・PUTについて、入力検証、ユーザー境界、repository連携、例外応答を `app.request` 経由の単体テストで保護する。

**Architecture:** エンドポイントごとにテストファイルを分け、Honoのルーティング・handler・response変換は実コードを使用する。認証は固定ユーザー、repositoryはDB境界としてmockし、HTTPレスポンスとhandlerから渡される引数を検証する。

**Tech Stack:** Bun、TypeScript、Hono、Vitest

## Global Constraints

- APIレスポンス仕様と本番コードの動作は変更しない。
- 実PostgreSQL、Drizzle SQL、DELETE Recipes APIは対象外とする。
- 入力検証は `validation.ts` を直接呼ばず、`app.request` 経由で検証する。
- repository mockはDBアクセスを隔離するためだけに使い、mock自身の動作をテストしない。
- `.serena/project.yml` の既存変更をステージしない。
- 仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- 既存動作を固定するcharacterization testのため、追加テストが失敗した場合は期待値を実装へ合わせず、仕様との差異を調査する。

---

## ファイル構成

- Create: `backend/src/recipes/getRecipes.test.ts`
  - GET一覧のレスポンス変換、空配列、userId、repository例外を検証する。
- Create: `backend/src/recipes/createRecipe.test.ts`
  - POSTの正常系、入力検証、repository引数、repository例外を検証する。
- Modify: `backend/src/recipes/getRecipeById.test.ts`
  - 既存の詳細取得テストへrepository例外を追加する。
- Create: `backend/src/recipes/updateRecipe.test.ts`
  - PUTの正常系、UUID・body検証、対象なし、repository例外を検証する。

### Task 1: GET一覧のAPI契約

**Files:**

- Create: `backend/src/recipes/getRecipes.test.ts`

**Interfaces:**

- Consumes: `app.request('/api/recipes')`、`listRecipesByUser(userId)`
- Produces: GET一覧のstatus、body、userId境界、例外応答を固定するテスト

- [ ] **Step 1: GET一覧のテストファイルを追加する**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { listRecipesByUserMock } = vi.hoisted(() => ({
  listRecipesByUserMock: vi.fn(),
}));

vi.mock("./repository", () => ({
  listRecipesByUser: listRecipesByUserMock,
  findRecipeWithIngredients: vi.fn(),
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock("../shared/auth", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
  getUserId: () => "user-123",
}));

import app from "../app";

describe("GET /api/recipes", () => {
  beforeEach(() => {
    listRecipesByUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("認証済みユーザーのレシピ一覧を返す", async () => {
    listRecipesByUserMock.mockResolvedValue([
      {
        recipeId: "11111111-1111-1111-1111-111111111111",
        userId: "user-123",
        name: "親子丼",
        sourceBook: "和食本",
        sourcePage: 12,
        baseServings: 2,
        memo: "半熟にする",
        createdAt: "2026-05-20T00:00:00.000Z",
        updatedAt: "2026-05-21T00:00:00.000Z",
      },
      {
        recipeId: "22222222-2222-2222-2222-222222222222",
        userId: "user-123",
        name: "みそ汁",
        sourceBook: null,
        sourcePage: null,
        baseServings: 1,
        memo: null,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:00.000Z",
      },
    ]);

    const response = await app.request("/api/recipes");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([
      {
        recipeId: "11111111-1111-1111-1111-111111111111",
        name: "親子丼",
        sourceBook: "和食本",
        sourcePage: 12,
        baseServings: 2,
        createdAt: "2026-05-20T00:00:00.000Z",
        updatedAt: "2026-05-21T00:00:00.000Z",
      },
      {
        recipeId: "22222222-2222-2222-2222-222222222222",
        name: "みそ汁",
        sourceBook: null,
        sourcePage: null,
        baseServings: 1,
        createdAt: "2026-05-22T00:00:00.000Z",
        updatedAt: "2026-05-22T00:00:00.000Z",
      },
    ]);
    expect(listRecipesByUserMock).toHaveBeenCalledWith("user-123");
  });

  it("レシピがない場合は空配列を返す", async () => {
    listRecipesByUserMock.mockResolvedValue([]);

    const response = await app.request("/api/recipes");

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it("repository例外時は500を返す", async () => {
    listRecipesByUserMock.mockRejectedValue(new Error("database error"));
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await app.request("/api/recipes");

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch recipes",
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: GET一覧テストを実行する**

Run:

```bash
cd backend
bun run test -- src/recipes/getRecipes.test.ts
```

Expected: 1ファイル・3テストがPASSする。FAILした場合は、GET一覧の仕様と現在のhandler動作の差異を調査する。

- [ ] **Step 3: GET一覧テストだけをコミットする**

```bash
git add backend/src/recipes/getRecipes.test.ts
git commit -m "test: Recipes一覧APIの契約を検証" -m "- レスポンス変換と空配列を確認
- userId境界とrepository例外時の500応答を確認"
```

### Task 2: POSTの正常系と入力検証

**Files:**

- Create: `backend/src/recipes/createRecipe.test.ts`

**Interfaces:**

- Consumes: `app.request('/api/recipes', { method: 'POST' })`、`createRecipeWithIngredients(input, ingredients)`
- Produces: POSTのstatus、body、入力変換、全validation分岐、例外応答を固定するテスト

- [ ] **Step 1: POSTのテストファイルを追加する**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { createRecipeWithIngredientsMock } = vi.hoisted(() => ({
  createRecipeWithIngredientsMock: vi.fn(),
}));

vi.mock("./repository", () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: vi.fn(),
  createRecipeWithIngredients: createRecipeWithIngredientsMock,
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock("../shared/auth", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
  getUserId: () => "user-123",
}));

import app from "../app";

const validBody = {
  name: "親子丼",
  baseServings: 2,
  ingredients: [
    {
      ingredientName: "鶏もも肉",
      quantity: 300,
      unit: "g",
    },
    {
      ingredientName: "塩",
      quantity: "少々",
      unit: "適量",
      note: "仕上げ用",
    },
  ],
};

const postRecipe = (body: unknown) =>
  app.request("/api/recipes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/recipes", () => {
  beforeEach(() => {
    createRecipeWithIngredientsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("変換済み入力をrepositoryへ渡して201を返す", async () => {
    createRecipeWithIngredientsMock.mockResolvedValue(
      "11111111-1111-1111-1111-111111111111",
    );

    const response = await postRecipe(validBody);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      recipeId: "11111111-1111-1111-1111-111111111111",
    });
    expect(createRecipeWithIngredientsMock).toHaveBeenCalledWith(
      {
        userId: "user-123",
        name: "親子丼",
        sourceBook: null,
        sourcePage: null,
        baseServings: 2,
        memo: null,
      },
      [
        {
          ingredientName: "鶏もも肉",
          quantity: 300,
          unit: "g",
          note: null,
        },
        {
          ingredientName: "塩",
          quantity: "少々",
          unit: "適量",
          note: "仕上げ用",
        },
      ],
    );
  });

  it("JSONとして解析できないbodyは400を返す", async () => {
    const response = await app.request("/api/recipes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid JSON in request body",
        details: null,
      },
    });
    expect(createRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: "nameが空",
      body: { ...validBody, name: " " },
      message: "Recipe name is required",
    },
    {
      caseName: "nameが文字列ではない",
      body: { ...validBody, name: 123 },
      message: "Recipe name is required",
    },
    {
      caseName: "baseServingsが0",
      body: { ...validBody, baseServings: 0 },
      message: "baseServings must be a positive number",
    },
    {
      caseName: "baseServingsが数値ではない",
      body: { ...validBody, baseServings: "2" },
      message: "baseServings must be a positive number",
    },
    {
      caseName: "ingredientsが配列ではない",
      body: { ...validBody, ingredients: null },
      message: "ingredients must be an array",
    },
    {
      caseName: "材料がオブジェクトではない",
      body: { ...validBody, ingredients: [null] },
      message: "Each ingredient must be an object",
    },
    {
      caseName: "ingredientNameが空",
      body: {
        ...validBody,
        ingredients: [{ ingredientName: " ", quantity: 1, unit: "個" }],
      },
      message: "Each ingredient must have a valid ingredientName",
    },
    {
      caseName: "ingredientNameが重複",
      body: {
        ...validBody,
        ingredients: [
          { ingredientName: "塩", quantity: 1, unit: "g" },
          { ingredientName: "  塩  ", quantity: 2, unit: "g" },
        ],
      },
      message: "Duplicate ingredient name:   塩  ",
    },
    {
      caseName: "数値quantityが0",
      body: {
        ...validBody,
        ingredients: [{ ingredientName: "塩", quantity: 0, unit: "g" }],
      },
      message:
        "Each ingredient must have a positive numeric quantity or a non-empty text quantity",
    },
    {
      caseName: "文字列quantityが空",
      body: {
        ...validBody,
        ingredients: [{ ingredientName: "塩", quantity: " ", unit: "g" }],
      },
      message:
        "Each ingredient must have a positive numeric quantity or a non-empty text quantity",
    },
    {
      caseName: "quantityが未対応型",
      body: {
        ...validBody,
        ingredients: [{ ingredientName: "塩", quantity: true, unit: "g" }],
      },
      message:
        "Each ingredient must have a positive numeric quantity or a non-empty text quantity",
    },
    {
      caseName: "unitが空",
      body: {
        ...validBody,
        ingredients: [{ ingredientName: "塩", quantity: 1, unit: " " }],
      },
      message: "Each ingredient must have a unit",
    },
  ])("$caseNameの場合は400を返す", async ({ body, message }) => {
    const response = await postRecipe(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "BAD_REQUEST", message, details: null },
    });
    expect(createRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it("repository例外時は500を返す", async () => {
    createRecipeWithIngredientsMock.mockRejectedValue(
      new Error("database error"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await postRecipe(validBody);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create recipe",
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: POSTテストを実行する**

Run:

```bash
cd backend
bun run test -- src/recipes/createRecipe.test.ts
```

Expected: 1ファイル・15テストがPASSする。FAILした場合は、`validateRecipeBody` とAPI仕様の差異を調査する。

- [ ] **Step 3: POSTテストだけをコミットする**

```bash
git add backend/src/recipes/createRecipe.test.ts
git commit -m "test: Recipes登録APIの契約を検証" -m "- 正常入力のrepository変換を確認
- JSONと各入力項目の不正時に400となることを確認
- repository例外時の500応答を確認"
```

### Task 3: GET詳細のrepository例外

**Files:**

- Modify: `backend/src/recipes/getRecipeById.test.ts`

**Interfaces:**

- Consumes: 既存の `findRecipeWithIngredientsMock`
- Produces: GET詳細のrepository例外時の500応答を固定するテスト

- [ ] **Step 1: console spyを必ず復元するcleanupを追加する**

importへ `afterEach` を追加する。

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
```

既存の `beforeEach` 直後へ追加する。

```typescript
afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 2: 既存describeの末尾へ例外テストを追加する**

`UUID 形式でない recipeId` のテスト直後、`describe` の閉じ括弧より前へ追加する。

```typescript
it("repository例外時は500を返す", async () => {
  const recipeId = "33333333-3333-3333-3333-333333333333";
  findRecipeWithIngredientsMock.mockRejectedValue(new Error("database error"));
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const response = await app.request(`/api/recipes/${recipeId}`);

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch recipe",
      details: null,
    },
  });
  expect(consoleError).toHaveBeenCalled();
});
```

- [ ] **Step 3: GET詳細テストを実行する**

Run:

```bash
cd backend
bun run test -- src/recipes/getRecipeById.test.ts
```

Expected: 1ファイル・4テストがPASSする。

- [ ] **Step 4: GET詳細の追加テストだけをコミットする**

```bash
git add backend/src/recipes/getRecipeById.test.ts
git commit -m "test: Recipes詳細APIの例外応答を検証" -m "- repository例外時に既存の500形式を返すことを確認"
```

### Task 4: PUTの正常系・不正入力・対象なし

**Files:**

- Create: `backend/src/recipes/updateRecipe.test.ts`

**Interfaces:**

- Consumes: `app.request('/api/recipes/:recipeId', { method: 'PUT' })`、`replaceRecipeWithIngredients(userId, recipeId, input, ingredients)`
- Produces: PUTのstatus、body、入力変換、repository非呼び出し、対象なし、例外応答を固定するテスト

- [ ] **Step 1: PUTのテストファイルを追加する**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { replaceRecipeWithIngredientsMock } = vi.hoisted(() => ({
  replaceRecipeWithIngredientsMock: vi.fn(),
}));

vi.mock("./repository", () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: vi.fn(),
  createRecipeWithIngredients: vi.fn(),
  replaceRecipeWithIngredients: replaceRecipeWithIngredientsMock,
}));

vi.mock("../shared/auth", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
  getUserId: () => "user-123",
}));

import app from "../app";

const recipeId = "11111111-1111-1111-1111-111111111111";
const validBody = {
  name: "親子丼（更新）",
  sourceBook: "和食本",
  sourcePage: 12,
  baseServings: 3,
  memo: "薄味にする",
  ingredients: [
    {
      ingredientName: "鶏もも肉",
      quantity: 320,
      unit: "g",
      note: "一口大",
    },
  ],
};

const putRecipe = (id: string, body: unknown) =>
  app.request(`/api/recipes/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("PUT /api/recipes/:recipeId", () => {
  beforeEach(() => {
    replaceRecipeWithIngredientsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("変換済み入力をrepositoryへ渡して200を返す", async () => {
    replaceRecipeWithIngredientsMock.mockResolvedValue(true);

    const response = await putRecipe(recipeId, validBody);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ recipeId });
    expect(replaceRecipeWithIngredientsMock).toHaveBeenCalledWith(
      "user-123",
      recipeId,
      {
        name: "親子丼（更新）",
        sourceBook: "和食本",
        sourcePage: 12,
        baseServings: 3,
        memo: "薄味にする",
      },
      [
        {
          ingredientName: "鶏もも肉",
          quantity: 320,
          unit: "g",
          note: "一口大",
        },
      ],
    );
  });

  it("UUID形式でないrecipeIdは404を返しrepositoryを呼ばない", async () => {
    const response = await putRecipe("not-a-uuid", validBody);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "RECIPE_NOT_FOUND",
        message: "Recipe not found",
        details: null,
      },
    });
    expect(replaceRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it("JSONとして解析できないbodyは400を返しrepositoryを呼ばない", async () => {
    const response = await app.request(`/api/recipes/${recipeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: "{",
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Invalid JSON in request body",
        details: null,
      },
    });
    expect(replaceRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it("入力不正は400を返しrepositoryを呼ばない", async () => {
    const response = await putRecipe(recipeId, { ...validBody, name: " " });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: "BAD_REQUEST",
        message: "Recipe name is required",
        details: null,
      },
    });
    expect(replaceRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it("別ユーザーまたは対象なしは404を返す", async () => {
    replaceRecipeWithIngredientsMock.mockResolvedValue(false);

    const response = await putRecipe(recipeId, validBody);

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: {
        code: "RECIPE_NOT_FOUND",
        message: "Recipe not found",
        details: null,
      },
    });
    expect(replaceRecipeWithIngredientsMock).toHaveBeenCalledWith(
      "user-123",
      recipeId,
      expect.any(Object),
      expect.any(Array),
    );
  });

  it("repository例外時は500を返す", async () => {
    replaceRecipeWithIngredientsMock.mockRejectedValue(
      new Error("database error"),
    );
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);

    const response = await putRecipe(recipeId, validBody);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update recipe",
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: PUTテストを実行する**

Run:

```bash
cd backend
bun run test -- src/recipes/updateRecipe.test.ts
```

Expected: 1ファイル・6テストがPASSする。

- [ ] **Step 3: PUTテストだけをコミットする**

```bash
git add backend/src/recipes/updateRecipe.test.ts
git commit -m "test: Recipes更新APIの契約を検証" -m "- 正常入力のrepository変換を確認
- UUIDとbody不正時のrepository非呼び出しを確認
- 対象なしとrepository例外の応答を確認"
```

### Task 5: 全体検証とIssue受け入れ条件の確認

**Files:**

- Verify: `backend/src/recipes/getRecipes.test.ts`
- Verify: `backend/src/recipes/createRecipe.test.ts`
- Verify: `backend/src/recipes/getRecipeById.test.ts`
- Verify: `backend/src/recipes/updateRecipe.test.ts`

**Interfaces:**

- Consumes: Tasks 1〜4のテスト
- Produces: Issue #152とPR作成前チェックを満たす検証結果

- [ ] **Step 1: Recipes APIの対象テストをまとめて実行する**

Run:

```bash
cd backend
bun run test -- src/recipes/getRecipes.test.ts src/recipes/createRecipe.test.ts src/recipes/getRecipeById.test.ts src/recipes/updateRecipe.test.ts
```

Expected: 4ファイル・28テストがPASSする。

- [ ] **Step 2: backend全テストを実行する**

Run:

```bash
cd backend
bun run test
```

Expected: 全テストがPASSし、skipと未処理のエラー・警告がない。

- [ ] **Step 3: リポジトリ共通チェックを実行する**

Run:

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
```

Expected: 4コマンドがexit code 0で完了する。

- [ ] **Step 4: スコープと差分を確認する**

Run:

```bash
git status --short
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
```

Expected:

- Issue #152の設計書、実装計画、Recipes APIテストだけがブランチ差分に含まれる。
- `.serena/project.yml` は未ステージの既存変更として残り、コミット差分に含まれない。
- whitespace errorがない。

- [ ] **Step 5: pushとdraft PR作成用の情報を用意する**

Branch:

```text
feature/152-expand-recipes-api-tests
```

PR title:

```text
Recipes APIの単体テストを拡充する
```

PR label:

```text
enhancement
```

PR bodyの `関連Issue/タスク`:

```text
closes #152
```
