# Menus API単体テスト拡充 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menus APIのGET・POST・PUT・DELETEについて、日付と入力の検証、ユーザー境界、repository連携、例外応答を `app.request` 経由の単体テストで保護する。

**Architecture:** エンドポイントごとにテストファイルを分け、Honoのルーティング・handler・response変換は実コードを使用する。認証は固定ユーザー、repositoryはDB境界としてmockし、HTTPレスポンスとhandlerから渡される引数を検証する。JSON bodyのトップレベル形状だけはPOST/PUT共通のvalidationで安全に拒否する。

**Tech Stack:** Bun、TypeScript、Hono、Vitest

## Global Constraints

- 実PostgreSQLを使用する統合テストは追加しない。
- APIの期間仕様と `mealType` の定義は変更しない。
- 献立画面のフロントエンドテストは変更しない。
- 入力検証は `validation.ts` を直接呼ばず、`app.request` 経由で検証する。
- repository mockはDBアクセスを隔離するためだけに使い、mock自身の動作をテストしない。
- 本番コードの変更は、Issue #153の受け入れ条件を満たすために必要な最小限に限定する。
- `.serena/project.yml` の既存変更をステージしない。
- 仕様書 `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- 既存契約のcharacterization testが失敗した場合は期待値を実装へ合わせず、Issueと仕様書との差異を調査する。

---

## ファイル構成

- Create: `backend/src/menus/getMenus.test.ts`
  - 既定・指定期間、レスポンス変換、日付検証、空結果、repository例外を検証する。
- Create: `backend/src/menus/createMenu.test.ts`
  - 登録成功、JSON・入力検証、repository引数、repository例外を検証する。
- Modify: `backend/src/menus/updateMenu.test.ts`
  - 既存4ケースを維持し、JSON・入力境界、別ユーザー、repository例外を追加する。
- Create: `backend/src/menus/deleteMenu.test.ts`
  - 削除成功、UUID不正、別ユーザーまたは対象なし、repository例外を検証する。
- Modify: `backend/src/menus/validation.ts`
  - POST/PUT共通でトップレベルbodyが非null・非配列のオブジェクトであることを検証する。

### Task 1: GETの期間・レスポンス契約

**Files:**

- Create: `backend/src/menus/getMenus.test.ts`

**Interfaces:**

- Consumes: `app.request('/api/menus')`、`listMenusInRange(userId: string, from: string, to: string): Promise<Menu[]>`
- Produces: GETの既定期間、指定期間、userId境界、日付検証、空結果、例外応答を固定するテスト

- [ ] **Step 1: 型付きrepository mockと固定時刻を用意する**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { listMenusInRange } from "./repository";

const { listMenusInRangeMock } = vi.hoisted(() => ({
  listMenusInRangeMock: vi.fn<typeof listMenusInRange>(),
}));

vi.mock("./repository", () => ({
  listMenusInRange: listMenusInRangeMock,
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: vi.fn(),
}));

vi.mock("../shared/auth", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
  getUserId: () => "user-123",
}));

import app from "../app";

describe("GET /api/menus", () => {
  beforeEach(() => {
    listMenusInRangeMock.mockReset();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-05-21T12:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: 既定期間と指定期間の契約テストを追加する**

```typescript
it("期間未指定時は固定した今日から7日分を取得する", async () => {
  listMenusInRangeMock.mockResolvedValue([
    {
      menuId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
      userId: "user-123",
      date: "2026-05-21",
      mealType: "DINNER",
      recipeId: "11111111-2222-3333-4444-555555555555",
      servings: 2,
      memo: "作り置き",
      createdAt: "2026-05-20T00:00:00.000Z",
      updatedAt: "2026-05-20T00:00:00.000Z",
    },
  ]);

  const response = await app.request("/api/menus");

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    from: "2026-05-21",
    to: "2026-05-27",
    items: [
      {
        menuId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
        date: "2026-05-21",
        mealType: "DINNER",
        recipeId: "11111111-2222-3333-4444-555555555555",
        servings: 2,
      },
    ],
  });
  expect(listMenusInRangeMock).toHaveBeenCalledWith(
    "user-123",
    "2026-05-21",
    "2026-05-27",
  );
});

it("指定期間をrepositoryへ渡し、空結果を返す", async () => {
  listMenusInRangeMock.mockResolvedValue([]);

  const response = await app.request(
    "/api/menus?from=2026-06-01&to=2026-06-03",
  );

  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({
    from: "2026-06-01",
    to: "2026-06-03",
    items: [],
  });
  expect(listMenusInRangeMock).toHaveBeenCalledWith(
    "user-123",
    "2026-06-01",
    "2026-06-03",
  );
});
```

- [ ] **Step 3: 日付不正とrepository例外の契約テストを追加する**

```typescript
it.each([
  {
    caseName: "fromの形式が不正",
    path: "/api/menus?from=2026-5-01&to=2026-05-03",
    message: 'Invalid "from" date format. Use YYYY-MM-DD',
  },
  {
    caseName: "toが実在しない日付",
    path: "/api/menus?from=2026-02-01&to=2026-02-30",
    message: 'Invalid "to" date format. Use YYYY-MM-DD',
  },
  {
    caseName: "fromがtoより後",
    path: "/api/menus?from=2026-06-04&to=2026-06-03",
    message: '"from" date must not be after "to" date',
  },
])(
  "$caseNameの場合は400を返しrepositoryを呼ばない",
  async ({ path, message }) => {
    const response = await app.request(path);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "BAD_REQUEST", message, details: null },
    });
    expect(listMenusInRangeMock).not.toHaveBeenCalled();
  },
);

it("repository例外時は500を返す", async () => {
  listMenusInRangeMock.mockRejectedValue(new Error("database error"));
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const response = await app.request(
    "/api/menus?from=2026-06-01&to=2026-06-03",
  );

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to fetch menus",
      details: null,
    },
  });
  expect(consoleError).toHaveBeenCalled();
});
```

- [ ] **Step 4: GETテストを実行してcharacterization結果を確認する**

Run: `cd backend && bun run test -- src/menus/getMenus.test.ts`

Expected: 追加したGETテストがすべてPASSする。FAILした場合は固定時刻、日付の期待値、現行handlerと仕様書の差異を確認し、期待値だけを変更しない。

- [ ] **Step 5: GETテストをコミットする**

```bash
git add -- backend/src/menus/getMenus.test.ts
git commit -m "test: Menus取得APIの契約を検証" -m "- 既定期間と指定期間のrepository引数を検証
- 日付不正時の400とrepository非呼び出しを検証
- 空結果とrepository例外のレスポンスを検証"
```

### Task 2: POSTの入力検証とrepository契約

**Files:**

- Create: `backend/src/menus/createMenu.test.ts`
- Modify: `backend/src/menus/validation.ts`

**Interfaces:**

- Consumes: `createMenu(input: NewMenuInput): Promise<string>`、`validateMenuBody(body: unknown): HandlerResult | null`
- Produces: POSTの201、400、500と変換済みrepository引数を固定するテスト、およびトップレベルbodyの安全な検証

- [ ] **Step 1: POSTの型付きmock、validBody、request helperを追加する**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { createMenu } from "./repository";

const { createMenuMock } = vi.hoisted(() => ({
  createMenuMock: vi.fn<typeof createMenu>(),
}));

vi.mock("./repository", () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: createMenuMock,
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: vi.fn(),
}));

vi.mock("../shared/auth", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
  getUserId: () => "user-123",
}));

import app from "../app";

const validBody = {
  date: "2026-05-21",
  mealType: "DINNER",
  recipeId: "11111111-2222-3333-4444-555555555555",
  servings: 2,
};

const postMenu = (body: unknown) =>
  app.request("/api/menus", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

describe("POST /api/menus", () => {
  beforeEach(() => {
    createMenuMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: 正常系とJSON解析失敗のテストを追加する**

```typescript
it("変換済み入力をrepositoryへ渡して201を返す", async () => {
  createMenuMock.mockResolvedValue("aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");

  const response = await postMenu(validBody);

  expect(response.status).toBe(201);
  expect(await response.json()).toEqual({
    menuId: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  });
  expect(createMenuMock).toHaveBeenCalledWith({
    userId: "user-123",
    date: "2026-05-21",
    mealType: "DINNER",
    recipeId: "11111111-2222-3333-4444-555555555555",
    servings: 2,
    memo: null,
  });
});

it("JSONとして解析できないbodyは400を返す", async () => {
  const response = await app.request("/api/menus", {
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
  expect(createMenuMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: トップレベルbody検証の失敗テストを追加する**

```typescript
it.each([
  { caseName: "null", body: null },
  { caseName: "配列", body: [] },
  { caseName: "文字列", body: "menu" },
  { caseName: "数値", body: 1 },
  { caseName: "真偽値", body: true },
])("トップレベルbodyが$caseNameの場合は400を返す", async ({ body }) => {
  const response = await postMenu(body);

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: {
      code: "BAD_REQUEST",
      message: "Request body must be an object",
      details: null,
    },
  });
  expect(createMenuMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 4: POSTテストを実行して意図した失敗を確認する**

Run: `cd backend && bun run test -- src/menus/createMenu.test.ts`

Expected: `null` は現行実装で500、配列やプリミティブは別の400 messageになるため、`Request body must be an object` の期待値でFAILする。正常系とJSON解析失敗はPASSする。

- [ ] **Step 5: validationへトップレベルbodyのguardを追加する**

`backend/src/menus/validation.ts` の `validateMenuBody` を次の形へ変更する。

```typescript
export const validateMenuBody = (body: unknown): HandlerResult | null => {
  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return badRequest("Request body must be an object");
  }

  const menu = body as Record<string, unknown>;

  if (!isNonEmptyString(menu.date) || !isValidDate(menu.date)) {
    return badRequest('Invalid "date" format. Use YYYY-MM-DD');
  }
  if (!isNonEmptyString(menu.mealType) || !isValidMealType(menu.mealType)) {
    return badRequest(
      'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER',
    );
  }
  if (!isNonEmptyString(menu.recipeId)) {
    return badRequest('"recipeId" is required');
  }
  if (!isPositiveNumber(menu.servings)) {
    return badRequest('"servings" must be a positive number');
  }
  return null;
};
```

`MenuBody` はhandlerからrepositoryへ渡す型として維持する。新しい共通helperは追加せず、既存Recipes validationと同じ判定をMenus validation内で使用する。

- [ ] **Step 6: 入力分岐とrepository例外のテストを追加する**

```typescript
it.each([
  {
    caseName: "dateが空",
    body: { ...validBody, date: " " },
    message: 'Invalid "date" format. Use YYYY-MM-DD',
  },
  {
    caseName: "dateが実在しない",
    body: { ...validBody, date: "2026-02-30" },
    message: 'Invalid "date" format. Use YYYY-MM-DD',
  },
  {
    caseName: "mealTypeが許可値でない",
    body: { ...validBody, mealType: "SNACK" },
    message:
      'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER',
  },
  {
    caseName: "mealTypeが文字列でない",
    body: { ...validBody, mealType: 1 },
    message:
      'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER',
  },
  {
    caseName: "recipeIdが空",
    body: { ...validBody, recipeId: " " },
    message: '"recipeId" is required',
  },
  {
    caseName: "recipeIdが文字列でない",
    body: { ...validBody, recipeId: 1 },
    message: '"recipeId" is required',
  },
  {
    caseName: "servingsが0",
    body: { ...validBody, servings: 0 },
    message: '"servings" must be a positive number',
  },
  {
    caseName: "servingsが数値でない",
    body: { ...validBody, servings: "2" },
    message: '"servings" must be a positive number',
  },
])(
  "$caseNameの場合は400を返しrepositoryを呼ばない",
  async ({ body, message }) => {
    const response = await postMenu(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: "BAD_REQUEST", message, details: null },
    });
    expect(createMenuMock).not.toHaveBeenCalled();
  },
);

it("repository例外時は500を返す", async () => {
  createMenuMock.mockRejectedValue(new Error("database error"));
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const response = await postMenu(validBody);

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to create menu",
      details: null,
    },
  });
  expect(consoleError).toHaveBeenCalled();
});
```

- [ ] **Step 7: POSTテストを再実行して成功を確認する**

Run: `cd backend && bun run test -- src/menus/createMenu.test.ts`

Expected: 追加したPOSTテストがすべてPASSし、トップレベルbody不正時にrepositoryが呼ばれない。

- [ ] **Step 8: POSTテストとvalidationをコミットする**

```bash
git add -- backend/src/menus/createMenu.test.ts backend/src/menus/validation.ts
git commit -m "test: Menus登録APIの契約を検証" -m "- 登録時のrepository引数と201レスポンスを検証
- JSONと主要入力の不正時に400となることを検証
- オブジェクトでないbodyを安全に拒否"
```

### Task 3: PUTの入力境界・ユーザー境界・例外契約

**Files:**

- Modify: `backend/src/menus/updateMenu.test.ts`

**Interfaces:**

- Consumes: `updateMenuForUser(userId: string, menuId: string, fields: Omit<NewMenuInput, 'userId'>): Promise<boolean>`
- Produces: PUTの200、400、404、500とrepository非呼び出しを固定する拡充テスト

- [ ] **Step 1: repository mockを実関数の型へ追従させ、後処理を追加する**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { updateMenuForUser } from "./repository";

const { updateMenuForUserMock } = vi.hoisted(() => ({
  updateMenuForUserMock: vi.fn<typeof updateMenuForUser>(),
}));

// 既存のvi.mockとapp importは維持する。

afterEach(() => {
  vi.restoreAllMocks();
});
```

- [ ] **Step 2: JSON解析失敗とトップレベルbody不正のテストを追加する**

```typescript
it("JSONとして解析できないbodyは400を返しrepositoryを呼ばない", async () => {
  const response = await app.request(`/api/menus/${MENU_UUID}`, {
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
  expect(updateMenuForUserMock).not.toHaveBeenCalled();
});

it.each([
  { caseName: "null", body: null },
  { caseName: "配列", body: [] },
  { caseName: "文字列", body: "menu" },
])("トップレベルbodyが$caseNameの場合は400を返す", async ({ body }) => {
  const response = await putMenu(body);

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: {
      code: "BAD_REQUEST",
      message: "Request body must be an object",
      details: null,
    },
  });
  expect(updateMenuForUserMock).not.toHaveBeenCalled();
});
```

- [ ] **Step 3: validation代表ケース、別ユーザー、repository例外を追加する**

```typescript
it("mealTypeが不正な場合は400を返しrepositoryを呼ばない", async () => {
  const response = await putMenu({
    date: "2026-05-21",
    mealType: "SNACK",
    recipeId: "recipe-new",
    servings: 2,
  });

  expect(response.status).toBe(400);
  expect(await response.json()).toEqual({
    error: {
      code: "BAD_REQUEST",
      message:
        'Invalid "mealType". Must be one of: BREAKFAST, LUNCH, DINNER, OTHER',
      details: null,
    },
  });
  expect(updateMenuForUserMock).not.toHaveBeenCalled();
});

it("別ユーザーまたは対象なしは404を返す", async () => {
  updateMenuForUserMock.mockResolvedValue(false);

  const response = await putMenu({
    date: "2026-05-21",
    mealType: "LUNCH",
    recipeId: "recipe-new",
    servings: 2,
  });

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "MENU_NOT_FOUND", message: "Menu not found", details: null },
  });
  expect(updateMenuForUserMock).toHaveBeenCalledWith(
    "user-123",
    MENU_UUID,
    expect.any(Object),
  );
});

it("repository例外時は500を返す", async () => {
  updateMenuForUserMock.mockRejectedValue(new Error("database error"));
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const response = await putMenu({
    date: "2026-05-21",
    mealType: "LUNCH",
    recipeId: "recipe-new",
    servings: 2,
  });

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to update menu",
      details: null,
    },
  });
  expect(consoleError).toHaveBeenCalled();
});
```

- [ ] **Step 4: PUTテストを実行する**

Run: `cd backend && bun run test -- src/menus/updateMenu.test.ts`

Expected: 既存4ケースと追加ケースがすべてPASSする。UUID不正、JSON不正、入力不正ではrepositoryが呼ばれない。

- [ ] **Step 5: PUTテストをコミットする**

```bash
git add -- backend/src/menus/updateMenu.test.ts
git commit -m "test: Menus更新APIの契約を補強" -m "- JSONと入力不正時の400とrepository非呼び出しを検証
- 別ユーザーまたは対象なしの404を明示
- repository例外時の500を検証"
```

### Task 4: DELETEの削除・ユーザー境界・例外契約

**Files:**

- Create: `backend/src/menus/deleteMenu.test.ts`

**Interfaces:**

- Consumes: `deleteMenuForUser(userId: string, menuId: string): Promise<boolean>`
- Produces: DELETEの204、404、500とuserId境界を固定するテスト

- [ ] **Step 1: DELETEの型付きrepository mockを用意する**

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { deleteMenuForUser } from "./repository";

const { deleteMenuForUserMock } = vi.hoisted(() => ({
  deleteMenuForUserMock: vi.fn<typeof deleteMenuForUser>(),
}));

vi.mock("./repository", () => ({
  listMenusInRange: vi.fn(),
  findMenuByIdForUser: vi.fn(),
  createMenu: vi.fn(),
  updateMenuForUser: vi.fn(),
  deleteMenuForUser: deleteMenuForUserMock,
}));

vi.mock("../shared/auth", () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) =>
    next(),
  getUserId: () => "user-123",
}));

import app from "../app";

const MENU_UUID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("DELETE /api/menus/:menuId", () => {
  beforeEach(() => {
    deleteMenuForUserMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });
});
```

- [ ] **Step 2: 204、UUID不正、対象なしのテストを追加する**

```typescript
it("認証済みユーザーの献立を削除して204を返す", async () => {
  deleteMenuForUserMock.mockResolvedValue(true);

  const response = await app.request(`/api/menus/${MENU_UUID}`, {
    method: "DELETE",
  });

  expect(response.status).toBe(204);
  expect(await response.text()).toBe("");
  expect(deleteMenuForUserMock).toHaveBeenCalledWith("user-123", MENU_UUID);
});

it("UUID形式でないmenuIdは404を返しrepositoryを呼ばない", async () => {
  const response = await app.request("/api/menus/not-a-uuid", {
    method: "DELETE",
  });

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "MENU_NOT_FOUND", message: "Menu not found", details: null },
  });
  expect(deleteMenuForUserMock).not.toHaveBeenCalled();
});

it("別ユーザーまたは対象なしは404を返す", async () => {
  deleteMenuForUserMock.mockResolvedValue(false);

  const response = await app.request(`/api/menus/${MENU_UUID}`, {
    method: "DELETE",
  });

  expect(response.status).toBe(404);
  expect(await response.json()).toEqual({
    error: { code: "MENU_NOT_FOUND", message: "Menu not found", details: null },
  });
  expect(deleteMenuForUserMock).toHaveBeenCalledWith("user-123", MENU_UUID);
});
```

- [ ] **Step 3: repository例外のテストを追加する**

```typescript
it("repository例外時は500を返す", async () => {
  deleteMenuForUserMock.mockRejectedValue(new Error("database error"));
  const consoleError = vi
    .spyOn(console, "error")
    .mockImplementation(() => undefined);

  const response = await app.request(`/api/menus/${MENU_UUID}`, {
    method: "DELETE",
  });

  expect(response.status).toBe(500);
  expect(await response.json()).toEqual({
    error: {
      code: "INTERNAL_SERVER_ERROR",
      message: "Failed to delete menu",
      details: null,
    },
  });
  expect(consoleError).toHaveBeenCalled();
});
```

- [ ] **Step 4: DELETEテストを実行する**

Run: `cd backend && bun run test -- src/menus/deleteMenu.test.ts`

Expected: 追加したDELETEテストがすべてPASSし、成功時のresponse bodyが空である。

- [ ] **Step 5: DELETEテストをコミットする**

```bash
git add -- backend/src/menus/deleteMenu.test.ts
git commit -m "test: Menus削除APIの契約を検証" -m "- 削除成功時の204とrepository引数を検証
- UUID不正と別ユーザーまたは対象なしの404を検証
- repository例外時の500を検証"
```

### Task 5: 全体検証と公開準備

**Files:**

- Verify: `backend/src/menus/getMenus.test.ts`
- Verify: `backend/src/menus/createMenu.test.ts`
- Verify: `backend/src/menus/updateMenu.test.ts`
- Verify: `backend/src/menus/deleteMenu.test.ts`
- Verify: `backend/src/menus/validation.ts`
- Verify: `docs/superpowers/specs/2026-07-27-menus-api-tests-design.md`
- Verify: `docs/superpowers/plans/2026-07-27-menus-api-tests.md`

**Interfaces:**

- Consumes: Tasks 1〜4のコミット済み成果物
- Produces: Issue #153の受け入れ条件を満たす検証証跡とPR作成可能なブランチ

- [ ] **Step 1: Menus対象テストをまとめて実行する**

Run:

```bash
cd backend
bun run test -- src/menus/getMenus.test.ts src/menus/createMenu.test.ts src/menus/updateMenu.test.ts src/menus/deleteMenu.test.ts
```

Expected: 4テストファイルがすべてPASSする。

- [ ] **Step 2: backend全テストを実行する**

Run:

```bash
cd backend
bun run test
```

Expected: 全テストファイルがPASSし、Issue着手前の117テストに追加ケースが加わっている。

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

Expected: `.serena/project.yml` は未ステージのままで、Issue #153に関係するspec、plan、Menusテスト、必要最小限のvalidation変更だけがコミットされている。

- [ ] **Step 5: pushとPR作成へ引き渡す**

ブランチ `feature/153-expand-menus-api-tests` をpushする。PRタイトルはIssueと同じ `Menus APIの単体テストを拡充する`、labelは `enhancement`、PR本文は `.github/PULL_REQUEST_TEMPLATE.md` に従い、`関連Issue/タスク` に `closes #153` を記載する。
