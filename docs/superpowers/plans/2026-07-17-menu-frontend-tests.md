# 献立機能フロントエンド単体テスト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 献立API、React Query hook、MenusPageの主要状態とCRUD操作を単体テストで保護し、削除前の確認UIを追加する。

**Architecture:** API層は `apiFetch` の呼び出し契約、hook層は実際の `QueryClientProvider` を通したquery・mutation、画面層はmockしたhookに対する表示と操作へ責務を分離する。削除確認だけは現行の即時削除を再現する失敗テストを先に追加し、`window.confirm` による最小実装で成功させる。

**Tech Stack:** React 19、TypeScript、TanStack React Query、Vitest、React Testing Library、`user-event`、Bun

## Global Constraints

- 人間のみが編集する `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- プロダクションコードの変更は `MenusPage.tsx` の削除確認UIだけに限定する。
- カレンダー内部、CSS、レスポンシブレイアウト、実API、実DBはテスト対象外とする。
- APIテスト、hookテスト、画面テストの責務を重複させない。
- 既存の `hooks/queryKeys.test.ts` を再利用し、同じQuery Key assertionを追加しない。
- テスト名、コミットメッセージ、PR本文は日本語で記載する。

---

## File Structure

- Create: `frontend/src/features/menus/api/menus.test.ts` — Menus APIのquery parameterとHTTP契約
- Create: `frontend/src/features/menus/hooks/useMenus.test.tsx` — 一覧queryの実行条件とcache分離
- Create: `frontend/src/features/menus/hooks/useCreateMenu.test.tsx` — 登録mutationとinvalidate
- Create: `frontend/src/features/menus/hooks/useUpdateMenu.test.tsx` — 更新mutationとinvalidate
- Create: `frontend/src/features/menus/hooks/useDeleteMenu.test.tsx` — 削除mutationとinvalidate
- Create: `frontend/src/features/menus/pages/MenusPage.test.tsx` — 表示状態、期間変更、追加・編集・削除
- Modify: `frontend/src/features/menus/pages/MenusPage.tsx` — 削除前の `window.confirm`

### Task 1: Menus APIのHTTP契約

**Files:**

- Create: `frontend/src/features/menus/api/menus.test.ts`

**Interfaces:**

- Consumes: `getMenus(params?: GetMenusParams)`、`createMenu(data)`、`updateMenu(menuId, data)`、`deleteMenu(menuId)`
- Produces: `apiFetch` に渡すURL、method、bodyと戻り値を保護するテスト

- [ ] **Step 1: 期間queryのテストを追加する**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/apiClient';
import { createMenu, deleteMenu, getMenus, updateMenu } from './menus';
import type { MenuInput, MenusResponse } from '../types';

vi.mock('@/lib/apiClient', () => ({ apiFetch: vi.fn() }));

const response: MenusResponse = {
  from: '2026-07-01',
  to: '2026-07-07',
  items: [],
};

describe('menus API', () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    [{}, '/menus'],
    [{ from: '2026-07-01' }, '/menus?from=2026-07-01'],
    [{ to: '2026-07-07' }, '/menus?to=2026-07-07'],
    [
      { from: '2026-07-01', to: '2026-07-07' },
      '/menus?from=2026-07-01&to=2026-07-07',
    ],
  ])('指定期間をquery parameterへ変換する', async (params, path) => {
    vi.mocked(apiFetch).mockResolvedValue(response);
    await expect(getMenus(params)).resolves.toBe(response);
    expect(apiFetch).toHaveBeenCalledWith(path, { method: 'GET' });
  });
```

- [ ] **Step 2: POST・PUT・DELETE契約を同じdescribeへ追加する**

```ts
  const input: MenuInput = {
    date: '2026-07-01',
    mealType: 'DINNER',
    recipeId: 'recipe-1',
    servings: 2,
  };

  it('POST /menusへ登録内容を渡す', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ menuId: 'menu-1' });
    await expect(createMenu(input)).resolves.toEqual({ menuId: 'menu-1' });
    expect(apiFetch).toHaveBeenCalledWith('/menus', { method: 'POST', body: input });
  });

  it('PUT /menus/{menuId}へ更新内容を渡す', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ menuId: 'menu-1' });
    await expect(updateMenu('menu-1', input)).resolves.toEqual({ menuId: 'menu-1' });
    expect(apiFetch).toHaveBeenCalledWith('/menus/menu-1', { method: 'PUT', body: input });
  });

  it('DELETE /menus/{menuId}を呼び出す', async () => {
    vi.mocked(apiFetch).mockResolvedValue(null);
    await expect(deleteMenu('menu-1')).resolves.toBeUndefined();
    expect(apiFetch).toHaveBeenCalledWith('/menus/menu-1', { method: 'DELETE' });
  });
});
```

- [ ] **Step 3: APIテストを実行する**

Run: `cd frontend && bun run test -- src/features/menus/api/menus.test.ts`

Expected: 7 tests PASS、0 failures。

- [ ] **Step 4: APIテストをコミットする**

```powershell
git add -- frontend/src/features/menus/api/menus.test.ts
git commit -m "test: 献立APIのHTTP契約を検証" -m "- 期間queryの未指定・片側・両側指定を確認`n- 登録・更新・削除のmethodとbodyを検証"
```

### Task 2: useMenusの実行条件とcache分離

**Files:**

- Create: `frontend/src/features/menus/hooks/useMenus.test.tsx`

**Interfaces:**

- Consumes: `useMenus({ from, to, userCacheKey, enabled })`、`createTestQueryClient()`、`createQueryWrapper(client)`
- Produces: API引数の正規化、enabled、ユーザー・期間別cacheを保護するテスト

- [ ] **Step 1: 実行条件と期間正規化を追加する**

```tsx
import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getMenus } from '../api/menus';
import { useMenus } from './useMenus';
import { createQueryWrapper, createTestQueryClient } from '@/test/queryClient';

vi.mock('../api/menus', () => ({ getMenus: vi.fn() }));

describe('useMenus', () => {
  beforeEach(() => vi.resetAllMocks());

  it('有効時に正規化した期間で一覧を取得する', async () => {
    vi.mocked(getMenus).mockResolvedValue({ from: '', to: '', items: [] });
    const client = createTestQueryClient();
    const { result } = renderHook(
      () => useMenus({ from: '', to: '2026-07-07', userCacheKey: 'user-a' }),
      { wrapper: createQueryWrapper(client) }
    );
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(getMenus).toHaveBeenCalledWith({ from: undefined, to: '2026-07-07' });
  });

  it('無効時は一覧を取得しない', () => {
    const client = createTestQueryClient();
    renderHook(() => useMenus({ enabled: false }), {
      wrapper: createQueryWrapper(client),
    });
    expect(getMenus).not.toHaveBeenCalled();
  });
```

- [ ] **Step 2: ユーザー・期間別cache分離を追加する**

```tsx
  it('ユーザーまたは期間が異なるqueryでcacheを共有しない', async () => {
    vi.mocked(getMenus).mockResolvedValue({ from: '', to: '', items: [] });
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(
      () => useMenus({ from: '2026-07-01', to: '2026-07-07', userCacheKey: 'user-a' }),
      { wrapper }
    );
    renderHook(
      () => useMenus({ from: '2026-07-08', to: '2026-07-14', userCacheKey: 'user-a' }),
      { wrapper }
    );
    renderHook(
      () => useMenus({ from: '2026-07-01', to: '2026-07-07', userCacheKey: 'user-b' }),
      { wrapper }
    );

    await waitFor(() => expect(getMenus).toHaveBeenCalledTimes(3));
  });
});
```

- [ ] **Step 3: query hookテストを実行する**

Run: `cd frontend && bun run test -- src/features/menus/hooks/useMenus.test.tsx src/features/menus/hooks/queryKeys.test.ts`

Expected: `useMenus` 3 testsと既存Query Key 3 testsがすべてPASS。

- [ ] **Step 4: query hookテストをコミットする**

```powershell
git add -- frontend/src/features/menus/hooks/useMenus.test.tsx
git commit -m "test: 献立queryの実行条件を検証" -m "- 空期間とenabled条件を確認`n- ユーザー・期間別のcache分離を検証"
```

### Task 3: 献立mutationとcache無効化

**Files:**

- Create: `frontend/src/features/menus/hooks/useCreateMenu.test.tsx`
- Create: `frontend/src/features/menus/hooks/useUpdateMenu.test.tsx`
- Create: `frontend/src/features/menus/hooks/useDeleteMenu.test.tsx`

**Interfaces:**

- Consumes: `useCreateMenu`、`useUpdateMenu`、`useDeleteMenu`、`menusQueryKeys.all(userKey)`
- Produces: mutation引数、成功時invalidate、失敗時非invalidateを保護するテスト

- [ ] **Step 1: 登録mutationの成功・失敗テストを追加する**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMenu } from "../api/menus";
import type { MenuInput } from "../types";
import { menusQueryKeys } from "./queryKeys";
import { useCreateMenu } from "./useCreateMenu";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";

vi.mock("../api/menus", () => ({ createMenu: vi.fn() }));
const input: MenuInput = {
  date: "2026-07-01",
  mealType: "DINNER",
  recipeId: "recipe-1",
  servings: 2,
};

describe("useCreateMenu", () => {
  beforeEach(() => vi.resetAllMocks());

  it("登録成功後に対象ユーザーの献立cacheをinvalidateする", async () => {
    vi.mocked(createMenu).mockResolvedValue({ menuId: "menu-1" });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useCreateMenu({ userCacheKey: "user-a" }),
      {
        wrapper: createQueryWrapper(client),
      },
    );
    await act(async () => void (await result.current.mutateAsync(input)));
    expect(createMenu).toHaveBeenCalledWith(input);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: menusQueryKeys.all("user-a"),
      }),
    );
  });

  it("登録失敗時はcacheをinvalidateしない", async () => {
    vi.mocked(createMenu).mockRejectedValue(new Error("登録失敗"));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useCreateMenu({ userCacheKey: "user-a" }),
      {
        wrapper: createQueryWrapper(client),
      },
    );
    await act(
      async () =>
        void (await expect(result.current.mutateAsync(input)).rejects.toThrow(
          "登録失敗",
        )),
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 更新mutationの成功・失敗テストを追加する**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { updateMenu } from "../api/menus";
import type { MenuInput } from "../types";
import { menusQueryKeys } from "./queryKeys";
import { useUpdateMenu } from "./useUpdateMenu";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";

vi.mock("../api/menus", () => ({ updateMenu: vi.fn() }));
const input: MenuInput = {
  date: "2026-07-01",
  mealType: "DINNER",
  recipeId: "recipe-1",
  servings: 2,
};

describe("useUpdateMenu", () => {
  beforeEach(() => vi.resetAllMocks());

  it("更新成功後に対象ユーザーの献立cacheをinvalidateする", async () => {
    vi.mocked(updateMenu).mockResolvedValue({ menuId: "menu-1" });
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useUpdateMenu({ menuId: "menu-1", userCacheKey: "user-a" }),
      { wrapper: createQueryWrapper(client) },
    );
    await act(async () => void (await result.current.mutateAsync(input)));
    expect(updateMenu).toHaveBeenCalledWith("menu-1", input);
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: menusQueryKeys.all("user-a"),
      }),
    );
  });

  it("更新失敗時はcacheをinvalidateしない", async () => {
    vi.mocked(updateMenu).mockRejectedValue(new Error("更新失敗"));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useUpdateMenu({ menuId: "menu-1", userCacheKey: "user-a" }),
      { wrapper: createQueryWrapper(client) },
    );
    await act(
      async () =>
        void (await expect(result.current.mutateAsync(input)).rejects.toThrow(
          "更新失敗",
        )),
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 削除mutationの成功・失敗テストを追加する**

```tsx
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteMenu } from "../api/menus";
import { menusQueryKeys } from "./queryKeys";
import { useDeleteMenu } from "./useDeleteMenu";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";

vi.mock("../api/menus", () => ({ deleteMenu: vi.fn() }));

describe("useDeleteMenu", () => {
  beforeEach(() => vi.resetAllMocks());

  it("削除成功後に対象ユーザーの献立cacheをinvalidateする", async () => {
    vi.mocked(deleteMenu).mockResolvedValue(undefined);
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useDeleteMenu({ userCacheKey: "user-a" }),
      {
        wrapper: createQueryWrapper(client),
      },
    );
    await act(async () => void (await result.current.mutateAsync("menu-1")));
    expect(deleteMenu).toHaveBeenCalledWith("menu-1");
    await waitFor(() =>
      expect(invalidate).toHaveBeenCalledWith({
        queryKey: menusQueryKeys.all("user-a"),
      }),
    );
  });

  it("削除失敗時はcacheをinvalidateしない", async () => {
    vi.mocked(deleteMenu).mockRejectedValue(new Error("削除失敗"));
    const client = createTestQueryClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(
      () => useDeleteMenu({ userCacheKey: "user-a" }),
      {
        wrapper: createQueryWrapper(client),
      },
    );
    await act(
      async () =>
        void (await expect(
          result.current.mutateAsync("menu-1"),
        ).rejects.toThrow("削除失敗")),
    );
    expect(invalidate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 4: mutation hookテストを実行する**

Run: `cd frontend && bun run test -- src/features/menus/hooks/useCreateMenu.test.tsx src/features/menus/hooks/useUpdateMenu.test.tsx src/features/menus/hooks/useDeleteMenu.test.tsx`

Expected: 6 tests PASS、0 failures。

- [ ] **Step 5: mutation hookテストをコミットする**

```powershell
git add -- frontend/src/features/menus/hooks/useCreateMenu.test.tsx frontend/src/features/menus/hooks/useUpdateMenu.test.tsx frontend/src/features/menus/hooks/useDeleteMenu.test.tsx
git commit -m "test: 献立mutationのcache無効化を検証" -m "- 登録・更新・削除のAPI引数を確認`n- 成功時invalidateと失敗時の非invalidateを検証"
```

### Task 4: MenusPageのfixtureと主要表示状態

**Files:**

- Create: `frontend/src/features/menus/pages/MenusPage.test.tsx`

**Interfaces:**

- Consumes: mocked `useMenus`、`useRecipes`、`useCreateMenu`、`useUpdateMenu`、`useDeleteMenu`
- Produces: 日付固定harness、loading・error・empty・一覧表示・期間変更テスト

- [ ] **Step 1: hook mockと固定日時harnessを作成する**

```tsx
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecipes } from '@/features/recipes';
import { useCreateMenu, useDeleteMenu, useMenus, useUpdateMenu } from '../hooks';
import type { MenuItem } from '../types';
import { MenusPage } from './MenusPage';

vi.mock('@/features/recipes', () => ({ useRecipes: vi.fn() }));
vi.mock('../hooks', () => ({
  useMenus: vi.fn(),
  useCreateMenu: vi.fn(),
  useUpdateMenu: vi.fn(),
  useDeleteMenu: vi.fn(),
}));

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
const menu: MenuItem = {
  menuId: 'menu-1', date: '2026-07-17', mealType: 'DINNER', recipeId: 'recipe-1', servings: 2,
};
const query = (overrides: object = {}) => ({
  data: { from: '2026-07-17', to: '2026-07-23', items: [] }, isLoading: false, error: null, ...overrides,
}) as ReturnType<typeof useMenus>;
const mutation = (mutateAsync: typeof createMutateAsync, overrides: object = {}) => ({
  mutateAsync, isPending: false, error: null, ...overrides,
});

describe('MenusPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-17T09:00:00+09:00'));
    vi.mocked(useMenus).mockReturnValue(query());
    vi.mocked(useRecipes).mockReturnValue({ data: [], isLoading: false, error: null } as ReturnType<typeof useRecipes>);
    vi.mocked(useCreateMenu).mockReturnValue(mutation(createMutateAsync) as ReturnType<typeof useCreateMenu>);
    vi.mocked(useUpdateMenu).mockReturnValue(mutation(updateMutateAsync) as ReturnType<typeof useUpdateMenu>);
    vi.mocked(useDeleteMenu).mockReturnValue(mutation(deleteMutateAsync) as ReturnType<typeof useDeleteMenu>);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
```

- [ ] **Step 2: loading・error・emptyを追加する**

```tsx
it.each([
  [query({ isLoading: true }), "献立を読み込み中..."],
  [query({ error: new Error("取得失敗") }), "献立の取得に失敗しました。"],
  [query(), "対象期間 (2026-07-17 〜 2026-07-23) に献立がありません。"],
])("主要状態を表示する", (state, text) => {
  vi.mocked(useMenus).mockReturnValue(state);
  render(<MenusPage />);
  expect(screen.getByText(text)).toBeInTheDocument();
});
```

- [ ] **Step 3: 一覧と期間変更を追加する**

```tsx
  it('日付と食事区分ごとに献立を表示する', () => {
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '2026-07-17', to: '2026-07-23', items: [menu] } }));
    vi.mocked(useRecipes).mockReturnValue({ data: [{ recipeId: 'recipe-1', name: 'カレー' }] } as ReturnType<typeof useRecipes>);
    render(<MenusPage />);
    expect(screen.getByRole('heading', { name: '2026-07-17' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '夜' })).toBeInTheDocument();
    expect(screen.getByText('レシピ名: カレー')).toBeInTheDocument();
  });

  it('未登録recipeIdを代替表示する', () => {
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);
    expect(screen.getByText('レシピ名: 未登録レシピ (recipe-1)')).toBeInTheDocument();
  });

  it('開始日と表示日数を取得期間へ反映する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MenusPage />);
    await user.clear(screen.getByLabelText('開始日'));
    await user.type(screen.getByLabelText('開始日'), '2026-08-01');
    await user.clear(screen.getByLabelText('表示日数'));
    await user.type(screen.getByLabelText('表示日数'), '3');
    expect(useMenus).toHaveBeenLastCalledWith({ from: '2026-08-01', to: '2026-08-03', enabled: true });
    expect(screen.getByText('API 取得期間: 2026-08-01 〜 2026-08-03')).toBeInTheDocument();
  });

  it.each([
    ['0', '1', '2026-07-17'],
    ['31', '30', '2026-08-15'],
  ])('表示日数を1日から30日の範囲へ補正する', async (input, normalized, endDate) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MenusPage />);
    const displayDays = screen.getByLabelText('表示日数');
    await user.clear(displayDays);
    await user.type(displayDays, input);
    await user.tab();
    expect(displayDays).toHaveValue(Number(normalized));
    expect(screen.getByText(`API 取得期間: 2026-07-17 〜 ${endDate}`)).toBeInTheDocument();
  });
});
```

- [ ] **Step 4: 表示状態テストを実行する**

Run: `cd frontend && bun run test -- src/features/menus/pages/MenusPage.test.tsx`

Expected: 8 tests PASS。日時・timer・mockの警告がない。

- [ ] **Step 5: 表示状態テストをコミットする**

```powershell
git add -- frontend/src/features/menus/pages/MenusPage.test.tsx
git commit -m "test: 献立画面の主要表示状態を検証" -m "- loading・error・empty・一覧表示を確認`n- 開始日と表示日数の期間反映を検証"
```

### Task 5: MenusPageの追加・編集操作

**Files:**

- Modify: `frontend/src/features/menus/pages/MenusPage.test.tsx`

**Interfaces:**

- Consumes: Task 4のfixture、`createMutateAsync`、`updateMutateAsync`
- Produces: 入力正規化、validation、成功後初期化、API失敗時状態保持を保護するテスト

- [ ] **Step 1: 追加のvalidationと正常入力を追加する**

`MenusPage.test.tsx` の `describe` 内へ、レシピ一覧が空のときに表示される `placeholder="recipeId"` の入力を使うテストを追加する。

```tsx
it("追加入力を正規化して登録する", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  createMutateAsync.mockResolvedValue({ menuId: "menu-2" });
  render(<MenusPage />);
  await user.clear(screen.getByLabelText("日付"));
  await user.type(screen.getByLabelText("日付"), "2026-07-20");
  await user.selectOptions(screen.getByLabelText("食事区分"), "LUNCH");
  await user.type(screen.getByPlaceholderText("recipeId"), "  recipe-2  ");
  await user.clear(screen.getByLabelText("人数"));
  await user.type(screen.getByLabelText("人数"), "3");
  await user.click(screen.getByRole("button", { name: "追加" }));
  expect(createMutateAsync).toHaveBeenCalledWith({
    date: "2026-07-20",
    mealType: "LUNCH",
    recipeId: "recipe-2",
    servings: 3,
  });
  expect(screen.getByPlaceholderText("recipeId")).toHaveValue("");
  expect(screen.getByLabelText("人数")).toHaveValue(1);
});

it("recipeIdが空の場合はブラウザーvalidationで登録しない", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<MenusPage />);
  const recipeId = screen.getByPlaceholderText("recipeId");
  await user.click(screen.getByRole("button", { name: "追加" }));
  expect(recipeId).toBeInvalid();
  expect(createMutateAsync).not.toHaveBeenCalled();
});

it("追加の不正な人数を表示して登録しない", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<MenusPage />);
  await user.type(screen.getByPlaceholderText("recipeId"), "recipe-2");
  await user.clear(screen.getByLabelText("人数"));
  await user.type(screen.getByLabelText("人数"), "0");
  await user.click(screen.getByRole("button", { name: "追加" }));
  expect(
    screen.getByText("人数は0より大きい値で入力してください。"),
  ).toBeInTheDocument();
  expect(createMutateAsync).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 登録失敗時の入力保持を追加する**

```tsx
it("登録失敗時にエラーと入力値を保持する", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  createMutateAsync.mockRejectedValue(new Error("登録できません"));
  render(<MenusPage />);
  await user.type(screen.getByPlaceholderText("recipeId"), "recipe-2");
  await user.clear(screen.getByLabelText("人数"));
  await user.type(screen.getByLabelText("人数"), "3");
  await user.click(screen.getByRole("button", { name: "追加" }));
  expect(await screen.findByText("登録できません")).toBeInTheDocument();
  expect(screen.getByPlaceholderText("recipeId")).toHaveValue("recipe-2");
  expect(screen.getByLabelText("人数")).toHaveValue(3);
});
```

- [ ] **Step 3: 編集の正常・validation・失敗状態保持を追加する**

一覧fixtureへ `[menu]` を設定してrenderし、`getByLabelText('レシピID')` と、複数存在する人数入力のうち登録済み行の入力を `getAllByLabelText('人数')[1]` で操作する。

```tsx
it("登録済み献立を編集して更新する", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  updateMutateAsync.mockResolvedValue({ menuId: "menu-1" });
  vi.mocked(useMenus).mockReturnValue(
    query({ data: { from: "", to: "", items: [menu] } }),
  );
  render(<MenusPage />);
  await user.clear(screen.getByLabelText("レシピID"));
  await user.type(screen.getByLabelText("レシピID"), " recipe-2 ");
  const servings = screen.getAllByLabelText("人数")[1];
  await user.clear(servings);
  await user.type(servings, "4");
  await user.click(screen.getByRole("button", { name: "更新" }));
  expect(updateMutateAsync).toHaveBeenCalledWith({
    date: "2026-07-17",
    mealType: "DINNER",
    recipeId: "recipe-2",
    servings: 4,
  });
});
```

```tsx
it("編集時にrecipeIdが空なら更新しない", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  vi.mocked(useMenus).mockReturnValue(
    query({ data: { from: "", to: "", items: [menu] } }),
  );
  render(<MenusPage />);
  await user.clear(screen.getByLabelText("レシピID"));
  await user.click(screen.getByRole("button", { name: "更新" }));
  expect(screen.getByText("レシピIDを入力してください。")).toBeInTheDocument();
  expect(updateMutateAsync).not.toHaveBeenCalled();
});

it("更新失敗時にエラーと編集中の値を保持する", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  updateMutateAsync.mockRejectedValue(new Error("更新できません"));
  vi.mocked(useMenus).mockReturnValue(
    query({ data: { from: "", to: "", items: [menu] } }),
  );
  render(<MenusPage />);
  await user.clear(screen.getByLabelText("レシピID"));
  await user.type(screen.getByLabelText("レシピID"), "recipe-2");
  const servings = screen.getAllByLabelText("人数")[1];
  await user.clear(servings);
  await user.type(servings, "4");
  await user.click(screen.getByRole("button", { name: "更新" }));
  expect(await screen.findByText("更新できません")).toBeInTheDocument();
  expect(screen.getByLabelText("レシピID")).toHaveValue("recipe-2");
  expect(servings).toHaveValue(4);
});
```

- [ ] **Step 4: 追加・編集テストを実行する**

Run: `cd frontend && bun run test -- src/features/menus/pages/MenusPage.test.tsx`

Expected: Task 4の8 testsに追加・編集の7 testsを加え、すべてPASS。

- [ ] **Step 5: 追加・編集テストをコミットする**

```powershell
git add -- frontend/src/features/menus/pages/MenusPage.test.tsx
git commit -m "test: 献立の追加と編集操作を検証" -m "- 入力正規化とvalidationを確認`n- API失敗時に編集中の値を保持することを検証"
```

### Task 6: 削除確認UIのRED・GREEN

**Files:**

- Modify: `frontend/src/features/menus/pages/MenusPage.test.tsx`
- Modify: `frontend/src/features/menus/pages/MenusPage.tsx`

**Interfaces:**

- Consumes: Task 4の一覧fixture、`deleteMutateAsync`、`window.confirm(message)`
- Produces: キャンセル時非削除、承認時削除、失敗時エラー表示を保証する確認UI

- [ ] **Step 1: キャンセル時に削除しない失敗テストを追加する**

```tsx
it("削除確認をキャンセルした場合は削除しない", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  vi.spyOn(window, "confirm").mockReturnValue(false);
  vi.mocked(useMenus).mockReturnValue(
    query({ data: { from: "", to: "", items: [menu] } }),
  );
  render(<MenusPage />);
  await user.click(screen.getByRole("button", { name: "削除" }));
  expect(window.confirm).toHaveBeenCalledWith("この献立を削除しますか？");
  expect(deleteMutateAsync).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: REDを確認する**

Run: `cd frontend && bun run test -- src/features/menus/pages/MenusPage.test.tsx -t "削除確認をキャンセル"`

Expected: FAIL。現行コードは `window.confirm` を呼ばず、`deleteMutateAsync('menu-1')` を呼ぶため。

- [ ] **Step 3: MenuItemEditorへ最小限の確認UIを実装する**

`frontend/src/features/menus/pages/MenusPage.tsx` の `handleDelete` を次の内容へ変更する。

```tsx
const handleDelete = async () => {
  if (!window.confirm("この献立を削除しますか？")) {
    return;
  }

  try {
    await onDelete(item.menuId);
    setErrorMessage(null);
  } catch (error) {
    setErrorMessage(
      error instanceof Error ? error.message : "削除に失敗しました。",
    );
  }
};
```

- [ ] **Step 4: GREENを確認する**

Run: `cd frontend && bun run test -- src/features/menus/pages/MenusPage.test.tsx -t "削除確認をキャンセル"`

Expected: 1 test PASS。

- [ ] **Step 5: 承認時と失敗時のテストを追加する**

```tsx
it("削除確認を承認した場合は対象menuIdを削除する", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  deleteMutateAsync.mockResolvedValue(undefined);
  vi.mocked(useMenus).mockReturnValue(
    query({ data: { from: "", to: "", items: [menu] } }),
  );
  render(<MenusPage />);
  await user.click(screen.getByRole("button", { name: "削除" }));
  expect(deleteMutateAsync).toHaveBeenCalledWith("menu-1");
});

it("削除失敗時にエラーと対象献立を表示し続ける", async () => {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  vi.spyOn(window, "confirm").mockReturnValue(true);
  deleteMutateAsync.mockRejectedValue(new Error("削除できません"));
  vi.mocked(useMenus).mockReturnValue(
    query({ data: { from: "", to: "", items: [menu] } }),
  );
  render(<MenusPage />);
  await user.click(screen.getByRole("button", { name: "削除" }));
  expect(await screen.findByText("削除できません")).toBeInTheDocument();
  expect(
    screen.getByText("レシピ名: 未登録レシピ (recipe-1)"),
  ).toBeInTheDocument();
});
```

- [ ] **Step 6: 削除関連を含む画面テストを実行する**

Run: `cd frontend && bun run test -- src/features/menus/pages/MenusPage.test.tsx`

Expected: Task 4〜6の全テストPASS、0 failures。

- [ ] **Step 7: 削除確認UIとテストをコミットする**

```powershell
git add -- frontend/src/features/menus/pages/MenusPage.tsx frontend/src/features/menus/pages/MenusPage.test.tsx
git commit -m "feat: 献立削除前に確認を表示" -m "- キャンセル時は削除処理を実行しない`n- 承認時と削除失敗時の画面動作をテスト"
```

### Task 7: 全体検証とDraft PR準備

**Files:**

- Verify: `frontend/src/features/menus/`
- Verify: `docs/superpowers/specs/2026-07-17-menu-frontend-tests-design.md`
- Verify: `docs/superpowers/plans/2026-07-17-menu-frontend-tests.md`

**Interfaces:**

- Consumes: Tasks 1〜6の全変更
- Produces: Issue #149をcloseできる検証済みDraft PR

- [ ] **Step 1: フロントエンド全テストを実行する**

Run: `cd frontend && bun run test`

Expected: 全test file PASS、0 failures、console error・warningなし。

- [ ] **Step 2: PR前の共通チェックを実行する**

Run: `cd .. && bun run lint && bun run format:check && bun run type-check && bun run build:all`

Expected: 連結した全コマンドがexit code 0。失敗した場合は対象を修正し、この連結コマンド全体を再実行する。

- [ ] **Step 3: 差分とスコープを確認する**

```powershell
git diff --check main...HEAD
git diff --stat main...HEAD
git status --short
```

Expected: whitespace errorなし。差分は設計・計画書、献立テスト、`MenusPage.tsx` の確認UIだけ。未コミット変更なし。

- [ ] **Step 4: 検証修正が生じた場合だけコミットする**

```powershell
git add -- frontend/src/features/menus
git commit -m "test: 献立機能テストの検証結果を反映" -m "- 全体検証で判明したテスト不整合を修正`n- Issue #149の対象範囲に限定して調整"
```

Expected: 修正がなければ空コミットを作らない。

- [ ] **Step 5: branchをpushする**

Run: `git push -u origin feature/149-add-menu-frontend-tests`

Expected: pre-push hookを含めてexit code 0、remote tracking branch更新。

- [ ] **Step 6: GitHubコネクターでDraft PRを作成する**

PR title: `献立機能のフロントエンド単体テストを追加する`

PR base/head: `main` ← `feature/149-add-menu-frontend-tests`

PR label: `enhancement`

PR bodyは `.github/PULL_REQUEST_TEMPLATE.md` をすべて日本語で埋め、「関連Issue/タスク」を `closes #149` とする。ユーザーに見える変更は「あり（削除前に確認ダイアログを表示）」、それ以外のプロダクション挙動・API・DB・認証への影響は「なし」と明記する。
