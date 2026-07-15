# レシピ機能フロントエンド単体テスト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** レシピ一覧・詳細・登録・更新のAPI契約、React Queryのcache制御、主要な表示とユーザー操作を単体テストで保護する。

**Architecture:** API、React Query hooks、components/pagesの責務ごとにテストを配置する。hookテストは実際のQueryClientを通し、画面テストはhookだけをモックしてユーザーから観測できる振る舞いを検証する。

**Tech Stack:** TypeScript 5.9、React 19、React Router 7、TanStack Query 5、Vitest 4、jsdom、React Testing Library、user-event

## Global Constraints

- 作業は `feature/148-add-recipe-frontend-tests` ブランチの現在の作業フォルダーで行い、別worktreeは作成しない。
- `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- 実ネットワーク、実バックエンド、CSS、レイアウト、snapshotは検証しない。
- 要素取得は文言、label、button、heading、table、dialogなどのアクセシブルなqueryを優先する。
- プロダクションコードは原則変更しない。不整合が判明した場合だけ、先に失敗を確認して最小修正する。
- characterization testは既存挙動を固定するため追加直後から成功してよい。本体修正を伴うテストだけred-greenを必須とする。
- 各QueryClientはretryを無効化してテストごとに生成し、mockとcacheをテスト間で共有しない。
- コミットメッセージは `<type>: <日本語要約>` とし、空行後に変更意図を日本語の箇条書きで記載する。

## File Structure

- Create: `frontend/src/test/queryClient.tsx` — hookテスト用QueryClientとProvider wrapper
- Create: `frontend/src/features/recipes/api/recipes.test.ts` — Recipes API関数のHTTP契約
- Create: `frontend/src/features/recipes/hooks/useRecipes.test.tsx` — 一覧query
- Create: `frontend/src/features/recipes/hooks/useRecipe.test.tsx` — 詳細query
- Create: `frontend/src/features/recipes/hooks/useCreateRecipe.test.tsx` — 登録mutation
- Create: `frontend/src/features/recipes/hooks/useUpdateRecipe.test.tsx` — 更新mutation
- Create: `frontend/src/features/recipes/components/RecipeList.test.tsx` — 一覧表示と選択
- Create: `frontend/src/features/recipes/components/RecipeDetail.test.tsx` — 詳細表示の状態分岐
- Create: `frontend/src/features/recipes/pages/RecipeListPage.test.tsx` — 一覧ページと遷移
- Create: `frontend/src/features/recipes/pages/RecipeNewPage.test.tsx` — 登録フォーム
- Create: `frontend/src/features/recipes/pages/RecipeDetailPage.test.tsx` — 詳細編集フォーム
- Modify only if required: 上記テストが既存仕様との不整合を示した対象のプロダクションファイル

---

### Task 1: Recipes APIの呼び出し契約

**Files:**

- Create: `frontend/src/features/recipes/api/recipes.test.ts`
- Test: `frontend/src/features/recipes/api/recipes.test.ts`

**Interfaces:**

- Consumes: `apiFetch<T>(path: string, options?: ApiRequestOptions): Promise<T>`
- Produces: GET/POST/PUTのpath、method、bodyを固定するテスト

- [ ] **Step 1: API関数テストを追加する**

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiClient";
import { createRecipe, getRecipe, getRecipes, updateRecipe } from "./recipes";
import type { CreateRecipeRequest, Recipe, RecipeDetail } from "../types";

vi.mock("@/lib/apiClient", () => ({ apiFetch: vi.fn() }));

const input: CreateRecipeRequest = {
  name: "鶏の照り焼き",
  sourceBook: "毎日の料理",
  sourcePage: 12,
  baseServings: 2,
  memo: null,
  ingredients: [
    { ingredientName: "鶏肉", quantity: 300, unit: "g", note: null },
  ],
};

describe("recipes API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("一覧をGET /recipesから取得する", async () => {
    const recipes: Recipe[] = [];
    vi.mocked(apiFetch).mockResolvedValue(recipes);
    await expect(getRecipes()).resolves.toBe(recipes);
    expect(apiFetch).toHaveBeenCalledWith("/recipes", { method: "GET" });
  });

  it("詳細をGET /recipes/{recipeId}から取得する", async () => {
    const detail = { recipeId: "recipe-1", ingredients: [] } as RecipeDetail;
    vi.mocked(apiFetch).mockResolvedValue(detail);
    await expect(getRecipe("recipe-1")).resolves.toBe(detail);
    expect(apiFetch).toHaveBeenCalledWith("/recipes/recipe-1", {
      method: "GET",
    });
  });

  it("POST /recipesへ登録内容を渡す", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ recipeId: "recipe-1" });
    await expect(createRecipe(input)).resolves.toEqual({
      recipeId: "recipe-1",
    });
    expect(apiFetch).toHaveBeenCalledWith("/recipes", {
      method: "POST",
      body: input,
    });
  });

  it("PUT /recipes/{recipeId}へ更新内容を渡す", async () => {
    vi.mocked(apiFetch).mockResolvedValue({ recipeId: "recipe-1" });
    await expect(updateRecipe("recipe-1", input)).resolves.toEqual({
      recipeId: "recipe-1",
    });
    expect(apiFetch).toHaveBeenCalledWith("/recipes/recipe-1", {
      method: "PUT",
      body: input,
    });
  });
});
```

- [ ] **Step 2: 対象テストを実行する**

Run: `cd frontend && bun run test -- src/features/recipes/api/recipes.test.ts`

Expected: 4 tests PASS。既存実装と契約が異なる場合はFAILを保持し、仕様書 `docs/04-api-design.md` と照合する。

- [ ] **Step 3: 必要な場合だけAPI関数を最小修正する**

```ts
export async function getRecipes(): Promise<Recipe[]> {
  return apiFetch<Recipe[]>("/recipes", { method: "GET" });
}
```

Expected: path、method、body以外のリファクタリングは行わない。修正不要ならこのStepは「変更なし」と記録する。

- [ ] **Step 4: 再実行して成功を確認する**

Run: `cd frontend && bun run test -- src/features/recipes/api/recipes.test.ts`

Expected: 4 tests PASS、0 failures。

- [ ] **Step 5: コミットする**

```powershell
git add frontend/src/features/recipes/api/recipes.test.ts frontend/src/features/recipes/api/recipes.ts
git commit -m "test: レシピAPIの呼び出し契約を検証" -m "- GET・POST・PUTのパスとメソッドを固定`n- 登録・更新時のリクエストボディを検証"
```

### Task 2: QueryClient helperと取得hooks

**Files:**

- Create: `frontend/src/test/queryClient.tsx`
- Create: `frontend/src/features/recipes/hooks/useRecipes.test.tsx`
- Create: `frontend/src/features/recipes/hooks/useRecipe.test.tsx`

**Interfaces:**

- Produces: `createTestQueryClient(): QueryClient`
- Produces: `createQueryWrapper(queryClient: QueryClient): ComponentType<PropsWithChildren>`
- Consumes: `useRecipes(options?)`、`useRecipe({ recipeId, userCacheKey?, enabled? })`

- [ ] **Step 1: QueryClient helperを追加する**

```tsx
import type { PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

export function createTestQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
}

export function createQueryWrapper(queryClient: QueryClient) {
  return function QueryWrapper({ children }: PropsWithChildren) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  };
}
```

- [ ] **Step 2: 一覧queryの実行条件とユーザー別cacheを検証する**

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRecipes } from "../api/recipes";
import { useRecipes } from "./useRecipes";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";

vi.mock("../api/recipes", () => ({ getRecipes: vi.fn() }));

describe("useRecipes", () => {
  beforeEach(() => vi.clearAllMocks());

  it("有効時に一覧を取得する", async () => {
    vi.mocked(getRecipes).mockResolvedValue([]);
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useRecipes({ userCacheKey: "user-a" }),
      {
        wrapper: createQueryWrapper(client),
      },
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getRecipes).toHaveBeenCalledOnce();
  });

  it("無効時は一覧を取得しない", () => {
    const client = createTestQueryClient();
    renderHook(() => useRecipes({ enabled: false }), {
      wrapper: createQueryWrapper(client),
    });
    expect(getRecipes).not.toHaveBeenCalled();
  });

  it("異なるユーザーのcacheを共有しない", async () => {
    vi.mocked(getRecipes).mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    const client = createTestQueryClient();
    renderHook(() => useRecipes({ userCacheKey: "user-a" }), {
      wrapper: createQueryWrapper(client),
    });
    renderHook(() => useRecipes({ userCacheKey: "user-b" }), {
      wrapper: createQueryWrapper(client),
    });
    await waitFor(() => expect(getRecipes).toHaveBeenCalledTimes(2));
  });
});
```

- [ ] **Step 3: 詳細queryの実行条件とcache境界を検証する**

```tsx
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getRecipe } from "../api/recipes";
import { useRecipe } from "./useRecipe";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";

vi.mock("../api/recipes", () => ({ getRecipe: vi.fn() }));

describe("useRecipe", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    { recipeId: "", enabled: true },
    { recipeId: "recipe-1", enabled: false },
  ])(
    "recipeId=$recipeId enabled=$enabledでは取得しない",
    ({ recipeId, enabled }) => {
      const client = createTestQueryClient();
      renderHook(() => useRecipe({ recipeId, enabled }), {
        wrapper: createQueryWrapper(client),
      });
      expect(getRecipe).not.toHaveBeenCalled();
    },
  );

  it("ユーザーとrecipeIdごとにcacheを分離する", async () => {
    vi.mocked(getRecipe).mockResolvedValue({ recipeId: "recipe-1" } as never);
    const client = createTestQueryClient();
    renderHook(
      () => useRecipe({ recipeId: "recipe-1", userCacheKey: "user-a" }),
      { wrapper: createQueryWrapper(client) },
    );
    renderHook(
      () => useRecipe({ recipeId: "recipe-2", userCacheKey: "user-a" }),
      { wrapper: createQueryWrapper(client) },
    );
    renderHook(
      () => useRecipe({ recipeId: "recipe-1", userCacheKey: "user-b" }),
      { wrapper: createQueryWrapper(client) },
    );
    await waitFor(() => expect(getRecipe).toHaveBeenCalledTimes(3));
  });
});
```

- [ ] **Step 4: 取得hookテストを実行する**

Run: `cd frontend && bun run test -- src/features/recipes/hooks/useRecipes.test.tsx src/features/recipes/hooks/useRecipe.test.tsx`

Expected: 5 tests PASS、不要なAPI呼び出し0件。

- [ ] **Step 5: コミットする**

```powershell
git add frontend/src/test/queryClient.tsx frontend/src/features/recipes/hooks/useRecipes.test.tsx frontend/src/features/recipes/hooks/useRecipe.test.tsx
git commit -m "test: レシピ取得フックのcache境界を検証" -m "- 無効条件ではAPIを呼ばないことを確認`n- ユーザーとレシピごとのQuery cache分離を検証"
```

### Task 3: 登録・更新mutation hooks

**Files:**

- Create: `frontend/src/features/recipes/hooks/useCreateRecipe.test.tsx`
- Create: `frontend/src/features/recipes/hooks/useUpdateRecipe.test.tsx`

**Interfaces:**

- Consumes: Task 2のQueryClient helper
- Produces: mutation引数と成功後invalidateの契約テスト

- [ ] **Step 1: 登録mutationを検証する**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createRecipe } from "../api/recipes";
import { recipesQueryKeys } from "./queryKeys";
import { useCreateRecipe } from "./useCreateRecipe";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";
import type { CreateRecipeRequest } from "../types";

vi.mock("../api/recipes", () => ({ createRecipe: vi.fn() }));
const input = {
  name: "スープ",
  baseServings: 2,
  ingredients: [],
} as CreateRecipeRequest;

it("登録成功後に対象ユーザーの一覧cacheをinvalidateする", async () => {
  vi.mocked(createRecipe).mockResolvedValue({ recipeId: "recipe-1" });
  const client = createTestQueryClient();
  const invalidate = vi.spyOn(client, "invalidateQueries");
  const { result } = renderHook(
    () => useCreateRecipe({ userCacheKey: "user-a" }),
    { wrapper: createQueryWrapper(client) },
  );
  await act(async () => {
    await result.current.mutateAsync(input);
  });
  expect(createRecipe).toHaveBeenCalledWith(input);
  await waitFor(() =>
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: recipesQueryKeys.list("user-a"),
    }),
  );
});
```

- [ ] **Step 2: 更新mutationと失敗時の非invalidateを検証する**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { updateRecipe } from "../api/recipes";
import { recipesQueryKeys } from "./queryKeys";
import { useUpdateRecipe } from "./useUpdateRecipe";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";
import type { UpdateRecipeRequest } from "../types";

vi.mock("../api/recipes", () => ({ updateRecipe: vi.fn() }));
const input = {
  name: "スープ",
  baseServings: 2,
  ingredients: [],
} as UpdateRecipeRequest;

describe("useUpdateRecipe", () => {
  it("成功後に一覧と対象詳細をinvalidateする", async () => {
    vi.mocked(updateRecipe).mockResolvedValue({ recipeId: "recipe-1" });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useUpdateRecipe({ recipeId: "recipe-1", userCacheKey: "user-a" }),
      { wrapper: createQueryWrapper(client) },
    );
    await act(async () => {
      await result.current.mutateAsync(input);
    });
    expect(updateRecipe).toHaveBeenCalledWith("recipe-1", input);
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(2));
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: recipesQueryKeys.list("user-a"),
    });
    expect(invalidate).toHaveBeenCalledWith({
      queryKey: recipesQueryKeys.detail("user-a", "recipe-1"),
    });
  });

  it("失敗時はcacheをinvalidateしない", async () => {
    vi.mocked(updateRecipe).mockRejectedValue(new Error("更新失敗"));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useUpdateRecipe({ recipeId: "recipe-1" }),
      { wrapper: createQueryWrapper(client) },
    );
    await act(async () => {
      await expect(result.current.mutateAsync(input)).rejects.toThrow(
        "更新失敗",
      );
    });
    expect(invalidate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: mutationテストを実行する**

Run: `cd frontend && bun run test -- src/features/recipes/hooks/useCreateRecipe.test.tsx src/features/recipes/hooks/useUpdateRecipe.test.tsx`

Expected: 3 tests PASS、成功時だけ正しいQuery Keyがinvalidateされる。

- [ ] **Step 4: コミットする**

```powershell
git add frontend/src/features/recipes/hooks/useCreateRecipe.test.tsx frontend/src/features/recipes/hooks/useUpdateRecipe.test.tsx
git commit -m "test: レシピmutation後のcache更新を検証" -m "- 登録後の一覧cache無効化を確認`n- 更新後の一覧・詳細cache無効化と失敗時の非実行を確認"
```

### Task 4: RecipeListとRecipeDetail components

**Files:**

- Create: `frontend/src/features/recipes/components/RecipeList.test.tsx`
- Create: `frontend/src/features/recipes/components/RecipeDetail.test.tsx`

**Interfaces:**

- Consumes: `RecipeList({ recipes, onRecipeClick })`、`RecipeDetail({ recipeId })`
- Produces: empty/success表示、選択、詳細状態分岐のテスト

- [ ] **Step 1: RecipeListのempty・success・選択を検証する**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RecipeList } from "./RecipeList";
import type { Recipe } from "../types";

const recipe: Recipe = {
  recipeId: "recipe-1",
  name: "カレー",
  sourceBook: "料理本",
  sourcePage: 10,
  baseServings: 2,
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};

describe("RecipeList", () => {
  it("空の場合に案内を表示する", () => {
    render(<RecipeList recipes={[]} />);
    expect(
      screen.getByText("登録されているレシピがありません。"),
    ).toBeInTheDocument();
  });

  it("一覧を表示して詳細選択を通知する", async () => {
    const onRecipeClick = vi.fn();
    render(<RecipeList recipes={[recipe]} onRecipeClick={onRecipeClick} />);
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("カレー")).toBeInTheDocument();
    expect(screen.getByText("料理本 (p.10)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "詳細を見る" }));
    expect(onRecipeClick).toHaveBeenCalledWith("recipe-1");
  });
});
```

- [ ] **Step 2: RecipeDetailの主要状態を検証する**

```tsx
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecipe } from "../hooks";
import { RecipeDetail } from "./RecipeDetail";

vi.mock("../hooks", () => ({ useRecipe: vi.fn() }));
const state = (value: object) => value as ReturnType<typeof useRecipe>;

describe("RecipeDetail", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [state({ isLoading: true }), "読み込み中..."],
    [state({ isLoading: false, error: new Error("取得失敗") }), "取得失敗"],
    [
      state({ isLoading: false, error: null, data: undefined }),
      "レシピが見つかりません",
    ],
  ])("%sの状態を表示する", (queryState, text) => {
    vi.mocked(useRecipe).mockReturnValue(queryState);
    render(<RecipeDetail recipeId="recipe-1" />);
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("基本情報と材料を表示する", () => {
    vi.mocked(useRecipe).mockReturnValue(
      state({
        isLoading: false,
        error: null,
        data: {
          recipeId: "recipe-1",
          name: "カレー",
          baseServings: 2,
          ingredients: [
            { ingredientName: "肉", quantity: 200, unit: "g", note: "一口大" },
          ],
          createdAt: "2026-01-01T00:00:00Z",
          updatedAt: "2026-01-02T00:00:00Z",
        },
      }),
    );
    render(<RecipeDetail recipeId="recipe-1" />);
    expect(screen.getByRole("heading", { name: "カレー" })).toBeInTheDocument();
    expect(screen.getByText(/肉: 200 g/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 3: componentテストを実行する**

Run: `cd frontend && bun run test -- src/features/recipes/components/RecipeList.test.tsx src/features/recipes/components/RecipeDetail.test.tsx`

Expected: 6 tests PASS。accessible queryで要素を取得できない場合だけ、既存表示を変えないlabel/role修正を検討する。

- [ ] **Step 4: コミットする**

```powershell
git add frontend/src/features/recipes/components/RecipeList.test.tsx frontend/src/features/recipes/components/RecipeDetail.test.tsx frontend/src/features/recipes/components/RecipeList.tsx frontend/src/features/recipes/components/RecipeDetail.tsx
git commit -m "test: レシピ一覧と詳細表示を検証" -m "- empty・error・successの表示を確認`n- レシピ選択と材料表示をユーザー操作で検証"
```

### Task 5: RecipeListPageの状態と遷移

**Files:**

- Create: `frontend/src/features/recipes/pages/RecipeListPage.test.tsx`

**Interfaces:**

- Consumes: mocked `useRecipes()`、実際のMemoryRouter
- Produces: loading/error/empty/successと2つの遷移テスト

- [ ] **Step 1: 状態と遷移を同じRouter harnessで検証する**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRecipes } from "../hooks";
import { RecipeListPage } from "./RecipeListPage";

vi.mock("../hooks", () => ({ useRecipes: vi.fn() }));
const state = (value: object) => value as ReturnType<typeof useRecipes>;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/recipes"]}>
      <Routes>
        <Route path="/recipes" element={<RecipeListPage />} />
        <Route path="/recipes/new" element={<p>登録画面</p>} />
        <Route path="/recipes/:recipeId" element={<p>詳細画面</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("RecipeListPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [state({ isLoading: true }), "読み込み中..."],
    [
      state({ isLoading: false, error: new Error("取得失敗") }),
      "レシピの読み込みに失敗しました。 (取得失敗)",
    ],
    [
      state({ isLoading: false, error: null, data: [] }),
      "登録されているレシピがありません。",
    ],
  ])("主要状態を表示する", (queryState, text) => {
    vi.mocked(useRecipes).mockReturnValue(queryState);
    renderPage();
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it("新規登録と詳細へ遷移する", async () => {
    vi.mocked(useRecipes).mockReturnValue(
      state({
        isLoading: false,
        error: null,
        data: [
          {
            recipeId: "recipe-1",
            name: "カレー",
            baseServings: 2,
            createdAt: "",
            updatedAt: "",
          },
        ],
      }),
    );
    renderPage();
    await userEvent.click(
      screen.getByRole("button", { name: "新規レシピを追加" }),
    );
    expect(screen.getByText("登録画面")).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: 詳細遷移は新しいrenderで確認する**

```tsx
it("詳細へ遷移する", async () => {
  vi.mocked(useRecipes).mockReturnValue(
    state({
      isLoading: false,
      error: null,
      data: [
        {
          recipeId: "recipe-1",
          name: "カレー",
          baseServings: 2,
          createdAt: "",
          updatedAt: "",
        },
      ],
    }),
  );
  renderPage();
  await userEvent.click(screen.getByRole("button", { name: "詳細を見る" }));
  expect(screen.getByText("詳細画面")).toBeInTheDocument();
});
```

- [ ] **Step 3: ページテストを実行する**

Run: `cd frontend && bun run test -- src/features/recipes/pages/RecipeListPage.test.tsx`

Expected: 5 tests PASS。

- [ ] **Step 4: コミットする**

```powershell
git add frontend/src/features/recipes/pages/RecipeListPage.test.tsx
git commit -m "test: レシピ一覧ページの状態と遷移を検証" -m "- loading・error・empty・success表示を確認`n- 登録画面と詳細画面への導線を検証"
```

### Task 6: RecipeNewPageの入力・登録・エラー

**Files:**

- Create: `frontend/src/features/recipes/pages/RecipeNewPage.test.tsx`
- Modify only if required: `frontend/src/features/recipes/pages/RecipeNewPage.tsx`

**Interfaces:**

- Consumes: mocked `useCreateRecipe().mutateAsync`
- Produces: validation、材料行操作、request正規化、成功遷移、失敗表示のテスト

- [ ] **Step 1: テストharnessとvalidationテストを追加する**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { useCreateRecipe } from "../hooks";
import { RecipeNewPage } from "./RecipeNewPage";

vi.mock("../hooks", () => ({ useCreateRecipe: vi.fn() }));
const mutateAsync = vi.fn();
const mutation = (overrides: object = {}) =>
  ({ mutateAsync, isPending: false, error: null, ...overrides }) as ReturnType<
    typeof useCreateRecipe
  >;
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/recipes/new"]}>
      <Routes>
        <Route path="/recipes/new" element={<RecipeNewPage />} />
        <Route path="/recipes/:recipeId" element={<p>作成した詳細</p>} />
      </Routes>
    </MemoryRouter>,
  );

describe("RecipeNewPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useCreateRecipe).mockReturnValue(mutation());
  });

  it("必須項目のエラーを表示して送信しない", async () => {
    renderPage();
    await userEvent.clear(screen.getByLabelText("基本人数 *"));
    await userEvent.click(screen.getByRole("button", { name: "保存" }));
    expect(
      screen.getByText("レシピ名を入力してください。"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("基本人数を入力してください。"),
    ).toBeInTheDocument();
    expect(screen.getByText("材料名を入力してください。")).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 材料行の追加・削除を検証する**

```tsx
it("材料行を追加・削除し最後の1行を残す", async () => {
  renderPage();
  expect(screen.getAllByLabelText("材料名 *")).toHaveLength(1);
  expect(screen.getByRole("button", { name: "この行を削除" })).toBeDisabled();
  await userEvent.click(screen.getByRole("button", { name: "材料行を追加" }));
  expect(screen.getAllByLabelText("材料名 *")).toHaveLength(2);
  const rows = screen.getAllByRole("button", { name: "この行を削除" });
  await userEvent.click(rows[1]);
  expect(screen.getAllByLabelText("材料名 *")).toHaveLength(1);
});
```

- [ ] **Step 3: request正規化と成功遷移を検証する**

```tsx
it("正規化したrequestを送信して詳細へ遷移する", async () => {
  mutateAsync.mockResolvedValue({ recipeId: "recipe-1" });
  renderPage();
  await userEvent.type(screen.getByLabelText("レシピ名 *"), "  カレー  ");
  await userEvent.type(screen.getByLabelText("出典本"), "  料理本  ");
  await userEvent.type(screen.getByLabelText("材料名 *"), "  肉  ");
  await userEvent.type(screen.getByLabelText("分量 *"), "200");
  await userEvent.type(screen.getByLabelText("単位 *"), "  g  ");
  await userEvent.click(screen.getByRole("button", { name: "保存" }));
  expect(mutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "カレー",
      sourceBook: "料理本",
      baseServings: 2,
      ingredients: [
        expect.objectContaining({
          ingredientName: "肉",
          quantity: 200,
          unit: "g",
        }),
      ],
    }),
  );
  expect(await screen.findByText("作成した詳細")).toBeInTheDocument();
});
```

- [ ] **Step 4: APIエラー表示と非遷移を検証する**

```tsx
it("APIエラーを表示して遷移しない", () => {
  vi.mocked(useCreateRecipe).mockReturnValue(
    mutation({
      error: new ApiError(400, "VALIDATION_ERROR", "登録できません"),
    }),
  );
  renderPage();
  expect(
    screen.getByText("保存に失敗しました。登録できません"),
  ).toBeInTheDocument();
  expect(screen.queryByText("作成した詳細")).not.toBeInTheDocument();
});
```

- [ ] **Step 5: 登録ページテストを実行する**

Run: `cd frontend && bun run test -- src/features/recipes/pages/RecipeNewPage.test.tsx`

Expected: validation、材料行、成功、失敗の4グループがPASS。labelで一意に取得できない場合は `getAllByLabelText` と行indexを使い、data-testidは追加しない。

- [ ] **Step 6: コミットする**

```powershell
git add frontend/src/features/recipes/pages/RecipeNewPage.test.tsx frontend/src/features/recipes/pages/RecipeNewPage.tsx
git commit -m "test: レシピ登録フォームの主要操作を検証" -m "- 必須入力と材料行の追加・削除を確認`n- request正規化、成功遷移、APIエラー表示を検証"
```

### Task 7: RecipeDetailPageの取得・編集・保存

**Files:**

- Create: `frontend/src/features/recipes/pages/RecipeDetailPage.test.tsx`
- Modify only if required: `frontend/src/features/recipes/pages/RecipeDetailPage.tsx`

**Interfaces:**

- Consumes: mocked `useRecipe`、`useUpdateRecipe`、`useCreateMenu`
- Produces: loading/error/not-found、初期値、編集request、成功・失敗のテスト

- [ ] **Step 1: 共通fixtureとhook stateを用意する**

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/apiClient";
import { useCreateMenu } from "@/features/menus";
import { useRecipe, useUpdateRecipe } from "../hooks";
import { RecipeDetailPage } from "./RecipeDetailPage";

vi.mock("../hooks", () => ({ useRecipe: vi.fn(), useUpdateRecipe: vi.fn() }));
vi.mock("@/features/menus", () => ({ useCreateMenu: vi.fn() }));

const recipe = {
  recipeId: "recipe-1",
  name: "カレー",
  sourceBook: "料理本",
  sourcePage: 10,
  baseServings: 2,
  memo: "辛口",
  ingredients: [{ ingredientName: "肉", quantity: 200, unit: "g", note: null }],
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-02T00:00:00Z",
};
const refetch = vi.fn();
const mutateAsync = vi.fn();
const renderPage = () =>
  render(
    <MemoryRouter initialEntries={["/recipes/recipe-1"]}>
      <Routes>
        <Route path="/recipes/:recipeId" element={<RecipeDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
const queryState = (overrides: object = {}) =>
  ({
    data: recipe,
    isLoading: false,
    error: null,
    refetch,
    ...overrides,
  }) as ReturnType<typeof useRecipe>;
const updateState = (overrides: object = {}) =>
  ({ mutateAsync, isPending: false, error: null, ...overrides }) as ReturnType<
    typeof useUpdateRecipe
  >;

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(useRecipe).mockReturnValue(queryState());
  vi.mocked(useUpdateRecipe).mockReturnValue(updateState());
  vi.mocked(useCreateMenu).mockReturnValue({
    mutateAsync: vi.fn(),
    isPending: false,
    error: null,
  } as ReturnType<typeof useCreateMenu>);
});
```

- [ ] **Step 2: loading・error・not-foundを検証する**

```tsx
it("loadingを表示する", () => {
  vi.mocked(useRecipe).mockReturnValue(
    queryState({ data: undefined, isLoading: true }),
  );
  renderPage();
  expect(screen.getByText("レシピを読み込み中です...")).toBeInTheDocument();
});

it("取得エラーを表示する", () => {
  vi.mocked(useRecipe).mockReturnValue(
    queryState({ data: undefined, error: new Error("取得失敗") }),
  );
  renderPage();
  expect(
    screen.getByRole("heading", { name: "レシピを読み込めませんでした" }),
  ).toBeInTheDocument();
});

it("404をnot-foundとして表示する", () => {
  vi.mocked(useRecipe).mockReturnValue(
    queryState({
      data: undefined,
      error: new ApiError(404, "RECIPE_NOT_FOUND", "なし"),
    }),
  );
  renderPage();
  expect(
    screen.getByRole("heading", { name: "レシピが見つかりません" }),
  ).toBeInTheDocument();
});
```

- [ ] **Step 3: 初期値と編集requestを検証する**

```tsx
it("初期値を編集して保存する", async () => {
  mutateAsync.mockResolvedValue({ recipeId: "recipe-1" });
  renderPage();
  const nameInput = screen.getByLabelText("レシピ名 *");
  expect(nameInput).toHaveValue("カレー");
  expect(screen.getByLabelText("材料名 *")).toHaveValue("肉");
  await userEvent.clear(nameInput);
  await userEvent.type(nameInput, "シチュー");
  await userEvent.click(screen.getByRole("button", { name: "編集して保存" }));
  expect(mutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({
      name: "シチュー",
      baseServings: 2,
      ingredients: [
        expect.objectContaining({
          ingredientName: "肉",
          quantity: 200,
          unit: "g",
        }),
      ],
    }),
  );
  expect(await screen.findByText("レシピを保存しました。")).toBeInTheDocument();
});
```

- [ ] **Step 4: validationとAPI失敗を検証する**

```tsx
it("validationエラーでは更新しない", async () => {
  renderPage();
  await userEvent.clear(screen.getByLabelText("レシピ名 *"));
  await userEvent.click(screen.getByRole("button", { name: "編集して保存" }));
  expect(screen.getByText("レシピ名を入力してください。")).toBeInTheDocument();
  expect(mutateAsync).not.toHaveBeenCalled();
});

it("更新APIエラーを表示する", () => {
  vi.mocked(useUpdateRecipe).mockReturnValue(
    updateState({
      error: new ApiError(400, "VALIDATION_ERROR", "更新できません"),
    }),
  );
  renderPage();
  expect(
    screen.getByText("保存に失敗しました。更新できません"),
  ).toBeInTheDocument();
});
```

- [ ] **Step 5: 詳細編集ページテストを実行する**

Run: `cd frontend && bun run test -- src/features/recipes/pages/RecipeDetailPage.test.tsx`

Expected: 主要状態、初期値、編集、成功、validation、API失敗がPASS。献立モーダルの詳細操作は追加しない。

- [ ] **Step 6: コミットする**

```powershell
git add frontend/src/features/recipes/pages/RecipeDetailPage.test.tsx frontend/src/features/recipes/pages/RecipeDetailPage.tsx
git commit -m "test: レシピ詳細編集の主要操作を検証" -m "- 取得状態とフォーム初期値を確認`n- 編集request、保存成功、validation、API失敗を検証"
```

### Task 8: 全体検証とPR準備

**Files:**

- Verify: Issue #148で追加・変更した全ファイル
- Verify: `docs/superpowers/specs/2026-07-13-recipe-frontend-tests-design.md`
- Verify: `docs/superpowers/plans/2026-07-13-recipe-frontend-tests.md`

**Interfaces:**

- Consumes: Tasks 1〜7の全テスト
- Produces: PR作成可能な検証済みブランチ

- [ ] **Step 1: フロントエンド全テストを実行する**

Run: `cd frontend && bun run test`

Expected: 既存5ファイル・22テストと追加テストがすべてPASS、0 failures。

- [ ] **Step 2: PR前の共通チェックを実行する**

Run: `cd .. && bun run lint && bun run format:check && bun run type-check && bun run build:all`

Expected: 全コマンドexit code 0。失敗した場合は対象を切り分け、修正後にこの連結コマンド全体を再実行する。

- [ ] **Step 3: docs固有チェックを実行する**

Run: `cd docs && bun install --frozen-lockfile && bun run format:check && bun run build`

Expected: frozen install、Prettier、Docusaurus buildがすべて成功する。

- [ ] **Step 4: 差分とスコープを確認する**

```powershell
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short
```

Expected: whitespace errorなし、Issue #148と設計・計画書以外の変更なし、未コミット変更なし。

- [ ] **Step 5: 最終コミットが必要な場合だけ作成する**

```powershell
git add -- frontend/src/features/recipes frontend/src/test/queryClient.tsx
git commit -m "test: レシピ機能テストの検証結果を反映" -m "- 全体検証で判明したテスト不整合を修正`n- Issue #148の対象範囲に限定して調整"
```

Expected: 検証による修正がなければコミットを作らない。

- [ ] **Step 6: pushとPR作成へ進む**

PRタイトル: `レシピ機能のフロントエンド単体テストを追加する`

PR本文の「関連Issue/タスク」: `closes #148`

PR label: Issue #148と同じ適切なlabel。`.github/PULL_REQUEST_TEMPLATE.md` の全項目を埋める。
