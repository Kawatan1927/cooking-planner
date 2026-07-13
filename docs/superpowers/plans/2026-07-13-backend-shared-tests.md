# バックエンド共通処理単体テスト実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** バックエンドの入力検証、HTTPレスポンス生成、Hono adapter、グローバル例外処理の既存契約を自動テストで保護する。

**Architecture:** 共通モジュールは公開関数の戻り値を直接検証し、Hono固有の変換はWeb標準 `Response` を観測する。handler例外は `adapt` で捕捉せず、テスト用にhealth routeをモックした実際のappを通して `app.onError` の既存挙動を検証する。

**Tech Stack:** Bun、TypeScript、Vitest 4、Hono、Web標準Response API

## Global Constraints

- API仕様とプロダクションコードの責務を変更しない。
- 実PostgreSQLと外部通信を使用しない。
- `adapt` に例外捕捉を追加しない。
- エラー形式は `{ error: { code, message, details } }` とする。
- 204レスポンスにはbodyとJSON用headerを付けない。
- `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。

---

## ファイル構成

- Create: `backend/src/shared/validation.test.ts` — 共通validationの正常値・境界値・不正値
- Create: `backend/src/shared/http.test.ts` — `HandlerResult` とエラー形式
- Create: `backend/src/shared/adapt.test.ts` — `HandlerResult` からWeb標準 `Response` への変換
- Create: `backend/src/app-error.test.ts` — 実際のappに設定されたHonoグローバル例外処理
- Modify: `docs/superpowers/specs/2026-07-13-backend-shared-tests-design.md` — app例外テストを専用ファイルへ分離する根拠

### Task 1: 共通validationの境界値を固定する

**Files:**

- Create: `backend/src/shared/validation.test.ts`

**Interfaces:**

- Consumes: `isUuid(value: string): boolean`、`isNonEmptyString(value: unknown): value is string`、`isPositiveNumber(value: unknown): value is number`、`isValidDate(value: string): boolean`
- Produces: validationの公開契約を保護する独立したVitestスイート

- [ ] **Step 1: validationテストを追加する**

```ts
import { describe, expect, it } from "vitest";
import {
  isNonEmptyString,
  isPositiveNumber,
  isUuid,
  isValidDate,
} from "./validation";

describe("isUuid", () => {
  it.each([
    "123e4567-e89b-12d3-a456-426614174000",
    "123E4567-E89B-12D3-A456-426614174000",
  ])("正しいUUIDを受け入れる: %s", (value) => expect(isUuid(value)).toBe(true));

  it.each([
    "",
    "123e4567e89b12d3a456426614174000",
    "123e4567-e89b-12d3-a456-42661417400g",
  ])("不正なUUIDを拒否する: %s", (value) => expect(isUuid(value)).toBe(false));
});

describe("isNonEmptyString", () => {
  it.each(["recipe", " recipe "])("空でない文字列を受け入れる", (value) =>
    expect(isNonEmptyString(value)).toBe(true),
  );
  it.each(["", "   ", null, undefined, 1, {}])(
    "空または非文字列を拒否する",
    (value) => expect(isNonEmptyString(value)).toBe(false),
  );
});

describe("isPositiveNumber", () => {
  it.each([1, 1.5, Number.MIN_VALUE])("有限の正数を受け入れる", (value) =>
    expect(isPositiveNumber(value)).toBe(true),
  );
  it.each([0, -1, NaN, Infinity, -Infinity, "1", null])(
    "正数でない値を拒否する",
    (value) => expect(isPositiveNumber(value)).toBe(false),
  );
});

describe("isValidDate", () => {
  it.each(["2026-07-13", "2024-02-29", "2026-01-31"])(
    "実在する日付を受け入れる",
    (value) => expect(isValidDate(value)).toBe(true),
  );
  it.each([
    "2023-02-29",
    "2026-02-30",
    "2026-13-01",
    "2026-00-10",
    "2026-01-00",
    "2026-1-01",
    "not-a-date",
  ])("不正な日付を拒否する", (value) => expect(isValidDate(value)).toBe(false));
});
```

- [ ] **Step 2: 対象テストを実行する**

Run: `cd backend && bunx vitest run src/shared/validation.test.ts`

Expected: 4 describe groupsがすべてPASSする。既存実装のcharacterization testであるため、プロダクションコード変更は発生しない。

- [ ] **Step 3: validationテストをコミットする**

```bash
git add backend/src/shared/validation.test.ts
git commit -m "test: 共通validationの境界値を検証"
```

### Task 2: HTTP helperの結果形式を固定する

**Files:**

- Create: `backend/src/shared/http.test.ts`

**Interfaces:**

- Consumes: `jsonResponse`、`noContent`、`errorResponse`、`badRequest`、`notFound`、`internalServerError`
- Produces: status、body、code、message、detailsの契約を保護するVitestスイート

- [ ] **Step 1: HTTP helperテストを追加する**

```ts
import { describe, expect, it } from "vitest";
import {
  badRequest,
  errorResponse,
  internalServerError,
  jsonResponse,
  noContent,
  notFound,
} from "./http";

describe("success responses", () => {
  it("statusとbodyを保持する", () => {
    expect(jsonResponse(201, { id: "recipe-id" })).toEqual({
      status: 201,
      body: { id: "recipe-id" },
    });
  });

  it("204ではbodyを持たない", () => {
    expect(noContent()).toEqual({ status: 204 });
  });
});

describe("error responses", () => {
  it("指定したstatus、code、message、detailsを保持する", () => {
    expect(
      errorResponse(422, "INVALID_VALUE", "Invalid value", { field: "name" }),
    ).toEqual({
      status: 422,
      body: {
        error: {
          code: "INVALID_VALUE",
          message: "Invalid value",
          details: { field: "name" },
        },
      },
    });
  });

  it.each([
    [badRequest, 400, "BAD_REQUEST"],
    [notFound, 404, "NOT_FOUND"],
    [internalServerError, 500, "INTERNAL_SERVER_ERROR"],
  ] as const)("既定のエラー形式を返す", (factory, status, code) => {
    expect(factory("message")).toEqual({
      status,
      body: { error: { code, message: "message", details: null } },
    });
  });

  it("helperでcodeを上書きできる", () => {
    expect(notFound("Recipe not found", "RECIPE_NOT_FOUND")).toEqual({
      status: 404,
      body: {
        error: {
          code: "RECIPE_NOT_FOUND",
          message: "Recipe not found",
          details: null,
        },
      },
    });
  });
});
```

- [ ] **Step 2: 対象テストを実行する**

Run: `cd backend && bunx vitest run src/shared/http.test.ts`

Expected: success responsesとerror responsesがすべてPASSする。

- [ ] **Step 3: HTTP helperテストをコミットする**

```bash
git add backend/src/shared/http.test.ts
git commit -m "test: HTTPレスポンス形式を検証"
```

### Task 3: adapterのResponse変換を固定する

**Files:**

- Create: `backend/src/shared/adapt.test.ts`

**Interfaces:**

- Consumes: `resultToResponse(result: HandlerResult): Response`、`adapt(handler)`、Hono `Context`
- Produces: status、header、JSON body、204、同期・非同期handler変換の契約を保護するVitestスイート

- [ ] **Step 1: adapterテストを追加する**

```ts
import type { Context } from "hono";
import { describe, expect, it } from "vitest";
import { adapt, resultToResponse } from "./adapt";

describe("resultToResponse", () => {
  it("JSON bodyとstatusとContent-TypeをResponseへ変換する", async () => {
    const response = resultToResponse({
      status: 201,
      body: { id: "recipe-id" },
    });
    expect(response.status).toBe(201);
    expect(response.headers.get("content-type")).toBe(
      "application/json; charset=utf-8",
    );
    expect(await response.json()).toEqual({ id: "recipe-id" });
  });

  it("204ではbodyとJSON用headerを付けない", async () => {
    const response = resultToResponse({ status: 204 });
    expect(response.status).toBe(204);
    expect(response.headers.get("content-type")).toBeNull();
    expect(await response.text()).toBe("");
  });
});

describe("adapt", () => {
  const context = {} as Context;

  it("同期handlerの結果をResponseへ変換する", async () => {
    const response = await adapt(() => ({ status: 200, body: { ok: true } }))(
      context,
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("非同期handlerの結果をResponseへ変換する", async () => {
    const response = await adapt(async () => ({
      status: 202,
      body: { accepted: true },
    }))(context);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
  });
});
```

- [ ] **Step 2: 対象テストを実行する**

Run: `cd backend && bunx vitest run src/shared/adapt.test.ts`

Expected: resultToResponseとadaptの4ケースがPASSする。

- [ ] **Step 3: adapterテストをコミットする**

```bash
git add backend/src/shared/adapt.test.ts
git commit -m "test: Hono adapterの変換を検証"
```

### Task 4: Honoグローバル例外処理を固定する

**Files:**

- Create: `backend/src/app-error.test.ts`
- Modify: `docs/superpowers/specs/2026-07-13-backend-shared-tests-design.md`

**Interfaces:**

- Consumes: `backend/src/app.ts` のdefault export、Hono route module `./routes/health`
- Produces: handler例外が実際の `app.onError` を通り500のAPIエラーへ変換される統合テスト

- [ ] **Step 1: 例外処理専用テストを追加する**

```ts
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./routes/health", async () => {
  const { Hono } = await import("hono");
  const route = new Hono();
  route.get("/", () => {
    throw new Error("test handler error");
  });
  return { default: route };
});

import app from "./app";

describe("app error handling", () => {
  afterEach(() => vi.restoreAllMocks());

  it("handler例外を既定の500エラー形式へ変換する", async () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const response = await app.request("/api/health");

    expect(response.status).toBe(500);
    expect(response.headers.get("content-type")).toContain("application/json");
    expect(await response.json()).toEqual({
      error: {
        code: "INTERNAL_SERVER_ERROR",
        message: "An unexpected error occurred",
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalledWith(
      "Unhandled error:",
      expect.any(Error),
    );
  });
});
```

- [ ] **Step 2: 例外処理テストを実行する**

Run: `cd backend && bunx vitest run src/app-error.test.ts`

Expected: 実際の `app.onError` を通る1ケースがPASSし、実PostgreSQLや外部通信は発生しない。

- [ ] **Step 3: バックエンド全テストを実行する**

Run: `cd backend && bun run test`

Expected: 既存6ファイル・27テストと追加4ファイルがすべてPASSし、skipとtimeoutがない。

- [ ] **Step 4: 設計補足と例外処理テストをコミットする**

```bash
git add backend/src/app-error.test.ts docs/superpowers/specs/2026-07-13-backend-shared-tests-design.md
git commit -m "test: handler例外の500変換を検証"
```

### Task 5: PR前の全体検証を行う

**Files:**

- Verify only: repository全体

**Interfaces:**

- Consumes: Tasks 1〜4の全テスト
- Produces: Issue #151の受け入れ条件とPR作成前チェックを満たす検証結果

- [ ] **Step 1: 共通チェックを実行する**

Run: `bun run lint && bun run format:check && bun run type-check && bun run build:all`

Expected: 4コマンドすべてexit code 0。

- [ ] **Step 2: docsチェックを実行する**

Run: `cd docs && bun install --frozen-lockfile && bun run format:check && bun run build`

Expected: lockfile変更なしでformatとDocusaurus buildがexit code 0。

- [ ] **Step 3: 差分と作業ツリーを確認する**

Run: `git diff --check origin/main...HEAD && git status --short --branch`

Expected: whitespace errorなし。変更対象が設計・計画文書と4つのテストファイルに限定される。

- [ ] **Step 4: 計画書をコミットする**

```bash
git add docs/superpowers/plans/2026-07-13-backend-shared-tests.md
git commit -m "docs: バックエンド共通処理テスト計画を追加"
```

- [ ] **Step 5: pushしてPRを作成する**

```bash
git push -u origin feature/151-add-backend-shared-tests
```

PRタイトルは `バックエンド共通処理の単体テストを追加する` とし、`enhancement` ラベルを付ける。本文は `.github/PULL_REQUEST_TEMPLATE.md` に従い、関連Issue欄へ `closes #151` を記載する。
