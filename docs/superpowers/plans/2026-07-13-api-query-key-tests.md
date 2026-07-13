# フロントエンド共通API・Query Key単体テスト 実装計画

> **エージェント作業者向け:** 必須サブスキルとして `superpowers:subagent-driven-development`（推奨）または `superpowers:executing-plans` を使用し、タスク単位で実装すること。各手順はチェックボックス（`- [ ]`）で追跡する。

**ゴール:** 共通APIクライアントとユーザー別Query Key生成規則を単体テストで固定し、Issue #147の受け入れ条件を満たす。

**アーキテクチャ:** Vitestのテストを対象モジュールと同じディレクトリに配置する。APIクライアントは `globalThis.fetch` の境界だけをモックし、Query Keyは生成されたreadonly tupleを直接比較して外部から観測できる契約を検証する。

**技術スタック:** TypeScript 5.9、Vitest 4、Vite 7、jsdom、Bun

## 全体制約

- 実ネットワークへ接続しない。
- 個別画面のレンダリングテストとE2Eテストは追加しない。
- `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- プロダクションコードは、受け入れ条件に反する挙動がテストで判明した場合のみ最小限修正する。
- テストファイルは対象モジュールと同じディレクトリへ配置する。

---

## ファイル構成

- `frontend/src/lib/apiClient.test.ts`: URL、リクエストオプション、成功レスポンス、APIエラーの契約を検証する。
- `frontend/src/lib/queryKeyUtils.test.ts`: ユーザーキャッシュキーの指定値と既定値を検証する。
- `frontend/src/features/recipes/hooks/queryKeys.test.ts`: Recipesのユーザー・ID分離を検証する。
- `frontend/src/features/menus/hooks/queryKeys.test.ts`: Menusのユーザー・検索期間分離を検証する。
- `frontend/src/features/shoppingList/hooks/queryKeys.test.ts`: Shopping Listのユーザー・検索期間分離を検証する。

### Task 1: APIクライアントのリクエスト契約

**Files:**

- Create: `frontend/src/lib/apiClient.test.ts`
- Test: `frontend/src/lib/apiClient.test.ts`

**Interfaces:**

- Consumes: `apiFetch<T>(path: string, options?: ApiFetchOptions): Promise<T>`
- Produces: URL正規化、header、JSON body、credentialsの回帰テスト

- [ ] **Step 1: リクエスト契約のテストを作成する**

```typescript
import { afterEach, describe, expect, it, vi } from "vitest";

import { apiFetch } from "./apiClient";

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });

describe("apiFetch request", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    ["https://example.com/api", "/recipes"],
    ["https://example.com/api/", "/recipes"],
    ["https://example.com/api", "recipes"],
    ["https://example.com/api/", "recipes"],
  ])("base URLが%s、pathが%sでもURLを正規化する", async (baseUrl, path) => {
    vi.stubEnv("VITE_API_BASE_URL", baseUrl);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch(path);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/recipes",
      expect.objectContaining({ credentials: "include" }),
    );
  });

  it("bodyをJSON化し既存headerとContent-Typeを設定する", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    const fetchMock = vi
      .fn()
      .mockResolvedValue(jsonResponse({ id: "recipe-1" }));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/recipes", {
      method: "POST",
      headers: { "X-Request-Id": "request-1" },
      body: { name: "カレー" },
    });

    expect(fetchMock).toHaveBeenCalledWith("https://example.com/api/recipes", {
      method: "POST",
      credentials: "include",
      headers: {
        "X-Request-Id": "request-1",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ name: "カレー" }),
    });
  });

  it("明示したcredentialsを尊重する", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal("fetch", fetchMock);

    await apiFetch("/recipes", { credentials: "omit" });

    expect(fetchMock).toHaveBeenCalledWith(
      "https://example.com/api/recipes",
      expect.objectContaining({ credentials: "omit" }),
    );
  });
});
```

- [ ] **Step 2: 対象テストを実行する**

Run: `cd frontend && bun run test src/lib/apiClient.test.ts`

Expected: URL正規化4ケース、JSON body/header、credentialsの計6ケースがPASSする。失敗した場合は期待値がIssue #147と既存設計に一致することを再確認し、プロダクションコード側を必要最小限修正する。

- [ ] **Step 3: 作業中の差分を確認する**

Run: `git diff --check && git diff -- frontend/src/lib/apiClient.test.ts frontend/src/lib/apiClient.ts`

Expected: whitespace errorがなく、Issue #147に関係する差分だけが表示される。

### Task 2: APIクライアントのレスポンス・エラー契約

**Files:**

- Modify: `frontend/src/lib/apiClient.test.ts`
- Test: `frontend/src/lib/apiClient.test.ts`

**Interfaces:**

- Consumes: `apiFetch<T>`、`ApiError`
- Produces: JSON成功、204、非JSON成功、構造化エラー、非JSONエラーの回帰テスト

- [ ] **Step 1: 同じテストファイルへレスポンス契約を追加する**

`apiClient.test.ts` のimportを次のように変更する。

```typescript
import { ApiError, apiFetch } from "./apiClient";
```

続けて次のテストを追加する。

```typescript
describe("apiFetch response", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("JSON成功レスポンスを返す", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse({ id: "recipe-1" })),
    );

    await expect(
      apiFetch<{ id: string }>("/recipes/recipe-1"),
    ).resolves.toEqual({
      id: "recipe-1",
    });
  });

  it("204レスポンスではnullを返す", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response(null, { status: 204 })),
    );

    await expect(
      apiFetch<null>("/menus/menu-1", { method: "DELETE" }),
    ).resolves.toBeNull();
  });

  it("非JSON成功レスポンスではnullを返す", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("accepted", {
          status: 202,
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    await expect(apiFetch<null>("/jobs")).resolves.toBeNull();
  });

  it("構造化JSONエラーからApiErrorを生成する", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: "VALIDATION_ERROR",
              message: "入力値が不正です",
              details: { field: "name" },
            },
          },
          { status: 400 },
        ),
      ),
    );

    const error = await apiFetch("/recipes").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      message: "入力値が不正です",
      details: { field: "name" },
    });
  });

  it("非JSONエラーの本文からUNKNOWN_ERRORを生成する", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response("Service unavailable", {
          status: 503,
          statusText: "Service Unavailable",
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    const error = await apiFetch("/recipes").catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 503,
      code: "UNKNOWN_ERROR",
      message: "Service unavailable",
    });
  });

  it("非JSONエラーの本文が空ならstatus textをmessageにする", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "https://example.com/api");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 502,
          statusText: "Bad Gateway",
          headers: { "Content-Type": "text/plain" },
        }),
      ),
    );

    await expect(apiFetch("/recipes")).rejects.toMatchObject({
      statusCode: 502,
      code: "UNKNOWN_ERROR",
      message: "Bad Gateway",
    });
  });
});
```

- [ ] **Step 2: APIクライアントの全テストを実行する**

Run: `cd frontend && bun run test src/lib/apiClient.test.ts`

Expected: Task 1を含む全12ケースがPASSする。

- [ ] **Step 3: APIクライアントテストをコミットする**

```bash
git add frontend/src/lib/apiClient.test.ts frontend/src/lib/apiClient.ts
git commit -m "test: 共通APIクライアントの契約を検証" -m "- URLとリクエストオプションの正規化を検証
- 成功レスポンスとApiErrorの生成規則を検証"
```

### Task 3: ユーザーキャッシュキーと各機能のQuery Key

**Files:**

- Create: `frontend/src/lib/queryKeyUtils.test.ts`
- Create: `frontend/src/features/recipes/hooks/queryKeys.test.ts`
- Create: `frontend/src/features/menus/hooks/queryKeys.test.ts`
- Create: `frontend/src/features/shoppingList/hooks/queryKeys.test.ts`

**Interfaces:**

- Consumes: `getUserCacheKey(userCacheKey?: string | null): string`、各機能の `queryKeys`
- Produces: ユーザー、ID、検索条件によるキャッシュ分離の回帰テスト

- [ ] **Step 1: ユーザーキャッシュキーのテストを作成する**

```typescript
import { describe, expect, it } from "vitest";

import { getUserCacheKey } from "./queryKeyUtils";

describe("getUserCacheKey", () => {
  it("指定したユーザーキーを返す", () => {
    expect(getUserCacheKey("user-1")).toBe("user-1");
  });

  it.each([undefined, null, ""])("%sの場合は既定キーを返す", (userKey) => {
    expect(getUserCacheKey(userKey)).toBe("cloudflare-access-user");
  });
});
```

- [ ] **Step 2: Recipes Query Keyのテストを作成する**

```typescript
import { describe, expect, it } from "vitest";

import { recipesQueryKeys } from "./queryKeys";

describe("recipesQueryKeys", () => {
  it("一覧をユーザーごとに分離する", () => {
    expect(recipesQueryKeys.list("user-1")).toEqual(["recipes", "user-1"]);
    expect(recipesQueryKeys.list("user-1")).not.toEqual(
      recipesQueryKeys.list("user-2"),
    );
  });

  it("詳細をユーザーとレシピIDごとに分離する", () => {
    expect(recipesQueryKeys.detail("user-1", "recipe-1")).toEqual([
      "recipes",
      "user-1",
      "recipe-1",
    ]);
    expect(recipesQueryKeys.detail("user-1", "recipe-1")).not.toEqual(
      recipesQueryKeys.detail("user-1", "recipe-2"),
    );
    expect(recipesQueryKeys.detail("user-1", "recipe-1")).not.toEqual(
      recipesQueryKeys.detail("user-2", "recipe-1"),
    );
  });
});
```

- [ ] **Step 3: Menus Query Keyのテストを作成する**

```typescript
import { describe, expect, it } from "vitest";

import { menusQueryKeys } from "./queryKeys";

describe("menusQueryKeys", () => {
  it("共通prefixをユーザーごとに分離する", () => {
    expect(menusQueryKeys.all("user-1")).toEqual(["menus", "user-1"]);
    expect(menusQueryKeys.all("user-1")).not.toEqual(
      menusQueryKeys.all("user-2"),
    );
  });

  it("一覧をユーザーと検索期間ごとに分離する", () => {
    expect(menusQueryKeys.list("user-1", "2026-07-01", "2026-07-07")).toEqual([
      "menus",
      "user-1",
      "2026-07-01",
      "2026-07-07",
    ]);
    expect(
      menusQueryKeys.list("user-1", "2026-07-01", "2026-07-07"),
    ).not.toEqual(menusQueryKeys.list("user-1", "2026-07-08", "2026-07-14"));
    expect(
      menusQueryKeys.list("user-1", "2026-07-01", "2026-07-07"),
    ).not.toEqual(menusQueryKeys.list("user-2", "2026-07-01", "2026-07-07"));
  });

  it("検索期間未指定をnullで表す", () => {
    expect(menusQueryKeys.list("user-1")).toEqual([
      "menus",
      "user-1",
      null,
      null,
    ]);
  });
});
```

- [ ] **Step 4: Shopping List Query Keyのテストを作成する**

```typescript
import { describe, expect, it } from "vitest";

import { shoppingListQueryKeys } from "./queryKeys";

describe("shoppingListQueryKeys", () => {
  it("一覧をユーザーと検索期間ごとに分離する", () => {
    expect(
      shoppingListQueryKeys.list("user-1", "2026-07-01", "2026-07-07"),
    ).toEqual(["shoppingList", "user-1", "2026-07-01", "2026-07-07"]);
    expect(
      shoppingListQueryKeys.list("user-1", "2026-07-01", "2026-07-07"),
    ).not.toEqual(
      shoppingListQueryKeys.list("user-1", "2026-07-08", "2026-07-14"),
    );
    expect(
      shoppingListQueryKeys.list("user-1", "2026-07-01", "2026-07-07"),
    ).not.toEqual(
      shoppingListQueryKeys.list("user-2", "2026-07-01", "2026-07-07"),
    );
  });
});
```

- [ ] **Step 5: Query Keyテストを実行する**

Run: `cd frontend && bun run test src/lib/queryKeyUtils.test.ts src/features/recipes/hooks/queryKeys.test.ts src/features/menus/hooks/queryKeys.test.ts src/features/shoppingList/hooks/queryKeys.test.ts`

Expected: 10ケースがPASSし、ユーザー、ID、検索期間が異なるキーは一致しない。

- [ ] **Step 6: Query Keyテストをコミットする**

```bash
git add frontend/src/lib/queryKeyUtils.test.ts frontend/src/features/recipes/hooks/queryKeys.test.ts frontend/src/features/menus/hooks/queryKeys.test.ts frontend/src/features/shoppingList/hooks/queryKeys.test.ts
git commit -m "test: Query Keyの分離規則を検証" -m "- ユーザーキャッシュキーの既定値を検証
- Recipes、Menus、Shopping Listのキャッシュ境界を検証"
```

### Task 4: 全体検証と公開準備

**Files:**

- Verify: Issue #147で追加・変更した全ファイル

**Interfaces:**

- Consumes: Task 1から3のテスト一式
- Produces: PR作成前チェックを通過した作業ブランチ

- [ ] **Step 1: フロントエンド依存関係をfrozen lockfileで確認する**

Run: `cd frontend && bun install --frozen-lockfile`

Expected: lockfile変更なしで成功する。

- [ ] **Step 2: Issue受け入れ条件のテストを実行する**

Run: `cd frontend && bun run test`

Expected: 全フロントエンドテストがPASSする。

- [ ] **Step 3: リポジトリ共通チェックを実行する**

Run: `bun run lint && bun run format:check && bun run type-check && bun run build:all`

Expected: lint、format、type-check、frontend/backend/docsのbuildがすべて成功する。

- [ ] **Step 4: 完了差分を監査する**

Run: `git status --short && git diff main...HEAD --check && git diff --stat main...HEAD`

Expected: Issue #147の設計書、計画書、5つのテストファイル、およびテストで必要性が判明した最小限のプロダクション修正のみが含まれる。

- [ ] **Step 5: 計画書に未コミット差分があればコミットする**

```bash
git add docs/superpowers/plans/2026-07-13-api-query-key-tests.md
git commit -m "docs: 共通APIテストの実装計画を追加" -m "- テストケースと検証コマンドを具体化
- Issue #147の完了監査手順を整理"
```

- [ ] **Step 6: 作業ブランチをpushする**

Run: `git push -u origin feature/147-add-api-query-key-tests`

Expected: originの同名ブランチへ全コミットがpushされ、pre-push hookが成功する。

- [ ] **Step 7: Issue #147を閉じるPRを作成する**

PRタイトル: `フロントエンド共通API・Query Keyの単体テストを追加する`

PR本文は `.github/PULL_REQUEST_TEMPLATE.md` に従い、関連Issue/タスクを `closes #147` とする。Issueと同じ適切なラベルを付与する。
