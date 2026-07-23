# 買い物リスト機能フロントエンド単体テスト Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 期間指定による買い物リスト取得とチェック操作を責務別のフロントエンド単体テストで保護し、Issue #150 の受け入れ条件を満たす。

**Architecture:** API、React Query hook、表示コンポーネント、ページを別々のテストファイルで検証する。各層では直下の依存だけをモックし、HTTP 契約、query 実行条件とキャッシュ分離、props に対する表示、利用者から観測できる画面状態と操作を重複なく確認する。

**Tech Stack:** TypeScript、React 19、React Router、TanStack React Query、Vitest、React Testing Library、`@testing-library/user-event`、Bun

## Global Constraints

- プロダクションコードと `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- 仕様と現行実装の不一致でテストが失敗した場合は、プロダクションコードを修正せずユーザーへ報告する。
- 実 API、実ネットワーク、実 DB、CSS、レスポンシブ表示、チェック状態の永続化は検証対象外とする。
- 非同期検証には `findBy*` または `waitFor` を使い、固定時間の待機は追加しない。
- テストの mock、QueryClient、システム日時はテスト間で共有しない。
- Issue、PR、コミットメッセージ、要約は日本語で記載する。

## File Structure

- Create: `frontend/src/features/shoppingList/api/shoppingList.test.ts`
  - `getShoppingList` が共通 API クライアントへ渡す URL、method、戻り値を検証する。
- Create: `frontend/src/features/shoppingList/hooks/useShoppingList.test.tsx`
  - query の実行条件、ユーザー・期間別キャッシュ、期間変更時の再取得を実際の React Query 上で検証する。
- Create: `frontend/src/features/shoppingList/components/ShoppingListItems.test.tsx`
  - 材料名、数量、単位、チェック件数、項目キーによるチェック操作を props 単位で検証する。
- Create: `frontend/src/features/shoppingList/pages/ShoppingListPage.test.tsx`
  - 期間指定、loading、error、empty、一覧、validation、チェック状態リセットを利用者操作として検証する。

---

### Task 1: Shopping List API 契約

**Files:**

- Create: `frontend/src/features/shoppingList/api/shoppingList.test.ts`
- Reference: `frontend/src/features/shoppingList/api/shoppingList.ts`
- Reference: `frontend/src/features/shoppingList/types.ts`

**Interfaces:**

- Consumes: `getShoppingList(params: { from: string; to: string }): Promise<ShoppingListResponse>`、`apiFetch<T>(path, options)`
- Produces: `getShoppingList` の query parameter、`GET` method、戻り値を保証するテスト

- [ ] **Step 1: API 契約テストを追加する**

Create `frontend/src/features/shoppingList/api/shoppingList.test.ts`:

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiFetch } from "@/lib/apiClient";
import type { ShoppingListResponse } from "../types";
import { getShoppingList } from "./shoppingList";

vi.mock("@/lib/apiClient", () => ({ apiFetch: vi.fn() }));

const response: ShoppingListResponse = {
  from: "2026-07-21",
  to: "2026-07-23",
  items: [
    {
      ingredientName: "玉ねぎ",
      totalQuantity: 1.5,
      unit: "個",
    },
  ],
};

describe("shoppingList API", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fromとtoをGET /shopping-listのquery parameterへ反映する", async () => {
    vi.mocked(apiFetch).mockResolvedValue(response);

    await expect(
      getShoppingList({ from: "2026-07-21", to: "2026-07-23" }),
    ).resolves.toBe(response);
    expect(apiFetch).toHaveBeenCalledWith(
      "/shopping-list?from=2026-07-21&to=2026-07-23",
      { method: "GET" },
    );
  });
});
```

- [ ] **Step 2: API 対象テストを実行する**

Run from `frontend`:

```powershell
bun run test src/features/shoppingList/api/shoppingList.test.ts
```

Expected: 1 test passes. 失敗した場合は URL、method、戻り値のどの契約が現行実装と一致しないかを記録し、プロダクションコードを変更せず停止する。

- [ ] **Step 3: API テストをコミットする**

```powershell
git add -- frontend/src/features/shoppingList/api/shoppingList.test.ts
git commit -m "test: 買い物リストAPI契約を検証" -m "- fromとtoを含むGETリクエストを検証`n- APIレスポンスをそのまま返す契約を固定"
```

---

### Task 2: useShoppingList の取得条件とキャッシュ

**Files:**

- Create: `frontend/src/features/shoppingList/hooks/useShoppingList.test.tsx`
- Reference: `frontend/src/features/shoppingList/hooks/useShoppingList.ts`
- Reference: `frontend/src/features/shoppingList/hooks/queryKeys.ts`
- Reference: `frontend/src/test/queryClient.tsx`

**Interfaces:**

- Consumes: `useShoppingList(options?: UseShoppingListOptions)`、`getShoppingList(params)`、`createTestQueryClient()`、`createQueryWrapper(queryClient)`
- Produces: 必須期間と `enabled` による実行制御、`userCacheKey`・期間別キャッシュ、props 変更時の再取得を保証するテスト

- [ ] **Step 1: hook テストを追加する**

Create `frontend/src/features/shoppingList/hooks/useShoppingList.test.tsx`:

```typescript
import { renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createQueryWrapper, createTestQueryClient } from "@/test/queryClient";
import { getShoppingList } from "../api/shoppingList";
import { useShoppingList } from "./useShoppingList";

vi.mock("../api/shoppingList", () => ({ getShoppingList: vi.fn() }));

const response = {
  from: "2026-07-21",
  to: "2026-07-23",
  items: [],
};

describe("useShoppingList", () => {
  beforeEach(() => vi.resetAllMocks());

  it("期間が揃った有効なqueryで買い物リストを取得する", async () => {
    vi.mocked(getShoppingList).mockResolvedValue(response);
    const client = createTestQueryClient();
    const { result } = renderHook(
      () =>
        useShoppingList({
          from: "2026-07-21",
          to: "2026-07-23",
          userCacheKey: "user-a",
        }),
      { wrapper: createQueryWrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(getShoppingList).toHaveBeenCalledWith({
      from: "2026-07-21",
      to: "2026-07-23",
    });
  });

  it("fromまたはtoがない場合は取得しない", () => {
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(
      () => useShoppingList({ to: "2026-07-23", userCacheKey: "user-a" }),
      {
        wrapper,
      },
    );
    renderHook(
      () => useShoppingList({ from: "2026-07-21", userCacheKey: "user-a" }),
      {
        wrapper,
      },
    );
    renderHook(() => useShoppingList({ userCacheKey: "user-a" }), { wrapper });

    expect(getShoppingList).not.toHaveBeenCalled();
  });

  it("enabledがfalseの場合は期間が揃っていても取得しない", () => {
    const client = createTestQueryClient();

    renderHook(
      () =>
        useShoppingList({
          from: "2026-07-21",
          to: "2026-07-23",
          userCacheKey: "user-a",
          enabled: false,
        }),
      { wrapper: createQueryWrapper(client) },
    );

    expect(getShoppingList).not.toHaveBeenCalled();
  });

  it("ユーザーまたは期間が異なるqueryでcacheを共有しない", async () => {
    vi.mocked(getShoppingList).mockResolvedValue(response);
    const client = createTestQueryClient();
    const wrapper = createQueryWrapper(client);

    renderHook(
      () =>
        useShoppingList({
          from: "2026-07-21",
          to: "2026-07-23",
          userCacheKey: "user-a",
        }),
      { wrapper },
    );
    renderHook(
      () =>
        useShoppingList({
          from: "2026-07-24",
          to: "2026-07-26",
          userCacheKey: "user-a",
        }),
      { wrapper },
    );
    renderHook(
      () =>
        useShoppingList({
          from: "2026-07-21",
          to: "2026-07-23",
          userCacheKey: "user-b",
        }),
      { wrapper },
    );

    await waitFor(() => expect(getShoppingList).toHaveBeenCalledTimes(3));
  });

  it("期間変更時に新しい期間で再取得する", async () => {
    vi.mocked(getShoppingList).mockResolvedValue(response);
    const client = createTestQueryClient();
    const { rerender } = renderHook(
      ({ from, to }) => useShoppingList({ from, to, userCacheKey: "user-a" }),
      {
        initialProps: { from: "2026-07-21", to: "2026-07-23" },
        wrapper: createQueryWrapper(client),
      },
    );
    await waitFor(() => expect(getShoppingList).toHaveBeenCalledTimes(1));

    rerender({ from: "2026-07-24", to: "2026-07-26" });

    await waitFor(() => expect(getShoppingList).toHaveBeenCalledTimes(2));
    expect(getShoppingList).toHaveBeenLastCalledWith({
      from: "2026-07-24",
      to: "2026-07-26",
    });
  });
});
```

- [ ] **Step 2: hook 対象テストを実行する**

Run from `frontend`:

```powershell
bun run test src/features/shoppingList/hooks/useShoppingList.test.tsx
```

Expected: 5 tests pass. 実行条件またはキャッシュ分離が失敗した場合は、失敗した query 条件を記録し、プロダクションコードを変更せず停止する。

- [ ] **Step 3: hook テストをコミットする**

```powershell
git add -- frontend/src/features/shoppingList/hooks/useShoppingList.test.tsx
git commit -m "test: 買い物リストquery条件を検証" -m "- 必須期間とenabledによるAPI実行条件を固定`n- ユーザー・期間別cacheと再取得を検証"
```

---

### Task 3: ShoppingListItems の表示とチェック操作

**Files:**

- Create: `frontend/src/features/shoppingList/components/ShoppingListItems.test.tsx`
- Reference: `frontend/src/features/shoppingList/components/ShoppingListItems.tsx`
- Reference: `frontend/src/features/shoppingList/types.ts`

**Interfaces:**

- Consumes: `ShoppingListItems({ items, checkedItems, onToggleItem })`、`ShoppingListItem`
- Produces: empty、数値・文字列数量、単位、チェック件数、`ingredientName + unit` の項目キーを保証するテスト

- [ ] **Step 1: コンポーネントテストを追加する**

Create `frontend/src/features/shoppingList/components/ShoppingListItems.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ShoppingListItem } from '../types';
import { ShoppingListItems } from './ShoppingListItems';

const items: ShoppingListItem[] = [
  { ingredientName: '玉ねぎ', totalQuantity: 1.5, unit: '個' },
  { ingredientName: '塩', totalQuantity: '少々', unit: '' },
  { ingredientName: '醤油', totalQuantity: '1 + 少々', unit: 'ml' },
];

describe('ShoppingListItems', () => {
  it('空のリストとチェック件数を表示する', () => {
    render(<ShoppingListItems items={[]} checkedItems={{}} onToggleItem={vi.fn()} />);

    expect(screen.getByText('0 / 0 件チェック済み')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeEmptyDOMElement();
  });

  it('材料名、数値・文字列数量、単位、チェック状態を表示する', () => {
    render(
      <ShoppingListItems
        items={items}
        checkedItems={{ '["玉ねぎ","個"]': true }}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText('玉ねぎ')).toBeInTheDocument();
    expect(screen.getByText('1.5個')).toBeInTheDocument();
    expect(screen.getByText('塩')).toBeInTheDocument();
    expect(screen.getByText('少々')).toBeInTheDocument();
    expect(screen.getByText('醤油')).toBeInTheDocument();
    expect(screen.getByText('1 + 少々ml')).toBeInTheDocument();
    expect(screen.getByText('1 / 3 件チェック済み')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /玉ねぎ/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /塩/ })).not.toBeChecked();
  });

  it('操作した材料名と単位の組み合わせだけを通知する', async () => {
    const user = userEvent.setup();
    const onToggleItem = vi.fn();
    const sameNameItems: ShoppingListItem[] = [
      { ingredientName: 'だし', totalQuantity: 1, unit: '袋' },
      { ingredientName: 'だし', totalQuantity: 2, unit: 'g' },
    ];
    render(
      <ShoppingListItems
        items={sameNameItems}
        checkedItems={{}}
        onToggleItem={onToggleItem}
      />
    );

    await user.click(screen.getAllByRole('checkbox', { name: /だし/ })[1]);

    expect(onToggleItem).toHaveBeenCalledOnce();
    expect(onToggleItem).toHaveBeenCalledWith('["だし","g"]');
  });
});
```

- [ ] **Step 2: コンポーネント対象テストを実行する**

Run from `frontend`:

```powershell
bun run test src/features/shoppingList/components/ShoppingListItems.test.tsx
```

Expected: 3 tests pass. 数量表示または項目キーが失敗した場合は、Issue #150 と API 仕様に対する差分を記録し、プロダクションコードを変更せず停止する。

- [ ] **Step 3: コンポーネントテストをコミットする**

```powershell
git add -- frontend/src/features/shoppingList/components/ShoppingListItems.test.tsx
git commit -m "test: 買い物リスト項目表示を検証" -m "- 数値・文字列数量と単位の表示を固定`n- 材料名と単位別のチェック操作を検証"
```

---

### Task 4: ShoppingListPage の期間・表示状態・チェック状態

**Files:**

- Create: `frontend/src/features/shoppingList/pages/ShoppingListPage.test.tsx`
- Reference: `frontend/src/features/shoppingList/pages/ShoppingListPage.tsx`
- Reference: `frontend/src/features/shoppingList/hooks/useShoppingList.ts`

**Interfaces:**

- Consumes: `ShoppingListPage()`、`useShoppingList(options)`、Memory Router の search parameter
- Produces: 未指定、loading、error、empty、一覧、期間更新、不正期間、対象項目だけのチェック、期間変更時リセットを保証するテスト

- [ ] **Step 1: ページテストを追加する**

Create `frontend/src/features/shoppingList/pages/ShoppingListPage.test.tsx`:

```typescript
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShoppingListItem } from '../types';
import { useShoppingList } from '../hooks';
import { ShoppingListPage } from './ShoppingListPage';

vi.mock('../hooks', () => ({ useShoppingList: vi.fn() }));

const onion: ShoppingListItem = {
  ingredientName: '玉ねぎ',
  totalQuantity: 1.5,
  unit: '個',
};
const salt: ShoppingListItem = {
  ingredientName: '塩',
  totalQuantity: '少々',
  unit: '',
};
const milk: ShoppingListItem = {
  ingredientName: '牛乳',
  totalQuantity: 300,
  unit: 'ml',
};

const query = (overrides: object = {}) =>
  ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    ...overrides,
  }) as unknown as ReturnType<typeof useShoppingList>;

const renderPage = (initialEntry = '/shopping-list') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ShoppingListPage />
    </MemoryRouter>
  );

describe('ShoppingListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 21, 9, 0, 0));
    vi.mocked(useShoppingList).mockReturnValue(query());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('有効な期間が未指定の場合は取得せず期間指定を案内する', () => {
    renderPage();

    expect(useShoppingList).toHaveBeenLastCalledWith({
      from: undefined,
      to: undefined,
      enabled: false,
    });
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-07-21');
    expect(screen.getByLabelText('終了日')).toHaveValue('2026-07-21');
    expect(
      screen.getByText('期間を指定して買い物リストを生成してください。')
    ).toBeInTheDocument();
  });

  it.each([
    [
      query({ isLoading: true }),
      ['買い物リストを読み込み中です...', '2026-07-21 〜 2026-07-23'],
    ],
    [
      query({ error: new Error('取得できません') }),
      ['買い物リストの取得に失敗しました。', '取得できません'],
    ],
    [
      query({ data: { from: '2026-07-21', to: '2026-07-23', items: [] } }),
      ['対象期間の買い物項目はありません。', '2026-07-21 〜 2026-07-23'],
    ],
  ])('loading、error、emptyを表示する', (queryState, expectedTexts) => {
    vi.mocked(useShoppingList).mockReturnValue(queryState);

    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    for (const text of expectedTexts) {
      expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
    }
  });

  it('URLの期間と材料一覧を表示する', () => {
    vi.mocked(useShoppingList).mockReturnValue(
      query({
        data: {
          from: '2026-07-21',
          to: '2026-07-23',
          items: [onion, salt],
        },
      })
    );

    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    expect(useShoppingList).toHaveBeenLastCalledWith({
      from: '2026-07-21',
      to: '2026-07-23',
      enabled: true,
    });
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-07-21');
    expect(screen.getByLabelText('終了日')).toHaveValue('2026-07-23');
    expect(screen.getByText('表示期間')).toBeInTheDocument();
    expect(screen.getByText('2026-07-21 〜 2026-07-23')).toBeInTheDocument();
    expect(screen.getByText('玉ねぎ')).toBeInTheDocument();
    expect(screen.getByText('1.5個')).toBeInTheDocument();
    expect(screen.getByText('塩')).toBeInTheDocument();
    expect(screen.getByText('少々')).toBeInTheDocument();
  });

  it('入力した期間を検索条件へ反映する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    fireEvent.change(screen.getByLabelText('開始日'), {
      target: { value: '2026-07-24' },
    });
    fireEvent.change(screen.getByLabelText('終了日'), {
      target: { value: '2026-07-26' },
    });
    await user.click(screen.getByRole('button', { name: 'リストを生成' }));

    expect(useShoppingList).toHaveBeenLastCalledWith({
      from: '2026-07-24',
      to: '2026-07-26',
      enabled: true,
    });
  });

  it.each([
    ['', '2026-07-23', '開始日と終了日を入力してください。'],
    ['2026-07-24', '2026-07-23', '終了日は開始日以降の日付を指定してください。'],
  ])('不正な期間は検索条件へ反映しない', (from, to, errorMessage) => {
    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    fireEvent.change(screen.getByLabelText('開始日'), { target: { value: from } });
    fireEvent.change(screen.getByLabelText('終了日'), { target: { value: to } });
    fireEvent.submit(screen.getByRole('button', { name: 'リストを生成' }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    expect(useShoppingList).not.toHaveBeenCalledWith({ from, to, enabled: true });
  });

  it('対象項目だけをチェックし期間変更後に状態をリセットする', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(useShoppingList).mockImplementation(({ from }) =>
      query({
        data: {
          from: from ?? '',
          to: from === '2026-07-24' ? '2026-07-26' : '2026-07-23',
          items: from === '2026-07-24' ? [onion, milk] : [onion, salt],
        },
      })
    );
    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');
    const onionCheckbox = screen.getByRole('checkbox', { name: /玉ねぎ/ });
    const saltCheckbox = screen.getByRole('checkbox', { name: /塩/ });

    await user.click(onionCheckbox);

    expect(onionCheckbox).toBeChecked();
    expect(saltCheckbox).not.toBeChecked();
    expect(screen.getByText('1 / 2 件チェック済み')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('開始日'), {
      target: { value: '2026-07-24' },
    });
    fireEvent.change(screen.getByLabelText('終了日'), {
      target: { value: '2026-07-26' },
    });
    await user.click(screen.getByRole('button', { name: 'リストを生成' }));

    expect(screen.getByText('牛乳')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /玉ねぎ/ })).not.toBeChecked();
    expect(screen.getByText('0 / 2 件チェック済み')).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: ページ対象テストを実行する**

Run from `frontend`:

```powershell
bun run test src/features/shoppingList/pages/ShoppingListPage.test.tsx
```

Expected: 9 tests pass. validation、表示状態、チェックリセットのいずれかが仕様と一致しない場合は、失敗した利用者操作と画面状態を記録し、プロダクションコードを変更せず停止する。

- [ ] **Step 3: 買い物リスト対象テストをまとめて実行する**

Run from `frontend`:

```powershell
bun run test src/features/shoppingList
```

Expected: 5 files and 19 tests pass, including the existing `hooks/queryKeys.test.ts` 1 test.

- [ ] **Step 4: ページテストをコミットする**

```powershell
git add -- frontend/src/features/shoppingList/pages/ShoppingListPage.test.tsx
git commit -m "test: 買い物リスト画面操作を検証" -m "- 期間指定と主要表示状態を検証`n- チェック操作と期間変更時のリセットを固定"
```

---

### Task 5: 全体検証と公開準備

**Files:**

- Verify: `frontend/src/features/shoppingList/**/*.test.tsx`
- Verify: `frontend/src/features/shoppingList/**/*.test.ts`
- Verify: `docs/superpowers/specs/2026-07-21-shopping-list-frontend-tests-design.md`
- Verify: `docs/superpowers/plans/2026-07-21-shopping-list-frontend-tests.md`
- Reference: `.github/PULL_REQUEST_TEMPLATE.md`

**Interfaces:**

- Consumes: リポジトリの `test`、`lint`、`format:check`、`type-check`、`build:all` scripts と GitHub Issue #150
- Produces: 検証済みコミット、remote branch、`enhancement` ラベル付き Draft PR

- [ ] **Step 1: frontend 全テストを実行する**

Run from `frontend`:

```powershell
bun run test
```

Expected: 25 files and 113 tests pass with 0 failures.

- [ ] **Step 2: リポジトリ共通チェックを実行する**

Run from repository root:

```powershell
bun run lint
bun run format:check
bun run type-check
bun run build:all
```

Expected: all four commands exit 0. Docusaurus の既存 warning は、build が exit 0 で完了する場合のみ非ブロッキングとして記録する。

- [ ] **Step 3: 差分とコミット範囲を確認する**

```powershell
git diff --check main...HEAD
git status -sb
git diff --stat main...HEAD
git log --oneline main..HEAD
```

Expected: whitespace errors are absent. 差分は設計書、実装計画、4つの買い物リストテストファイルだけで、プロダクションコードは含まれない。

- [ ] **Step 4: branch を push する**

```powershell
git push -u origin feature/150-add-shopping-list-frontend-tests
```

Expected: pre-push hook を含めて成功し、`origin/feature/150-add-shopping-list-frontend-tests` が作成される。

- [ ] **Step 5: Issue テンプレートに沿った Draft PR を作成する**

PR title:

```text
買い物リスト機能のフロントエンド単体テストを追加する
```

PR body:

```markdown
## 概要（必須）

- このPRの目的：買い物リスト機能のAPI、React Query hook、項目表示、ページ操作を単体テストで保護する
- 主な変更点：責務別に4つのテストファイルを追加
- ユーザーに見える変更：なし

## 背景 / 関連（必須）

- 関連Issue/タスク：closes #150
- 参照ドキュメント（docs/\*.md）：
  - docs/01-vision-and-scope.md（該当箇所：買い物リスト）
  - docs/02-features-and-screens.md（該当画面：2.7 買い物リスト画面）
  - docs/03-domain-and-data-model.md（該当モデル/テーブル：6. ShoppingListドメイン）
  - docs/04-api-design.md（該当エンドポイント：GET /shopping-list）
  - docs/05-architecture-notes.md（該当事項：React Queryによるサーバー状態管理）

## 変更内容（必須）

- フロントエンド：
  - 追加/変更した画面・コンポーネント：ShoppingListItemsとShoppingListPageのテストのみ追加
  - API 呼び出し（features/<domain>/api/\*.ts）の追加/変更：getShoppingListの既存HTTP契約をテストで検証
  - React Query フック（hooks/use\*.ts）の追加/変更：useShoppingListの既存取得条件とcache分離をテストで検証
- バックエンド（Bun + Hono）：
  - エンドポイント（パス + メソッド）：変更なし
  - PostgreSQL 操作（テーブル・トランザクション・クエリ等）：変更なし
  - レスポンス形式（docs/04 に準拠）：変更なし
- 公開/認証：
  - Cloudflare Access / Tunnel 設定への影響：なし
  - 環境変数：変更なし

## 仕様との整合性（必須）

- どの仕様に基づいているか：docs/01からdocs/05の買い物リスト画面、ShoppingListドメイン、GET /shopping-list契約
- 仕様との差分がある場合：差分なし

## 影響範囲（必須）

- フロントエンド：単体テストのみ。ルーティング、状態管理、ビルド設定への影響なし
- バックエンド：影響なし
- データ：PostgreSQLスキーマ、マイグレーション、バックフィルは不要
- 認証/認可：影響なし
- 公開/運用コスト：影響なし

## 移行・リリース・ロールバック（必要な場合）

- データ移行/バックフィル：該当なし
- フィーチャーフラグ/段階的リリース：該当なし
- ロールバック方針：追加したテストコミットをrevertする

## 動作確認 / テスト（必須）

- 確認環境：開発
- 手動確認手順：
  1. `cd frontend && bun run test` を実行する
  2. リポジトリルートで共通チェックとbuildを実行する
- 期待結果：全テストと全チェックが成功する
- 追加したテスト：API、hook、ShoppingListItems、ShoppingListPageの単体テスト
- 既存テストへの影響：なし

## スクリーンショット / 動画（UI変更がある場合）

該当なし

## 破壊的変更

- なし

---

## チェックリスト（全て日本語で記載すること）

- [x] すべての記述（タイトル/本文/コメント/チェックリスト等）は日本語で記載した
- [x] 対応する Issue を起点に作業し、必要なラベルを設定した
- [x] 変更は小さめで、スコープが明確（関係ない整形を混ぜない）
- [x] 関連する docs/\*.md を確認し、実装はドキュメントを優先した
- [x] 仕様とコードに齟齬がある場合の判断/補足を本文に記載した（齟齬なし）

### フロントエンド

- [x] API呼び出しは既存のlib/apiClient.ts経由であることを確認した
- [x] features/shoppingList/apiの既存ラッパーをテストした
- [x] React Queryの既存カスタムフックをテストした
- [x] 未ログイン時の挙動を変更していない

### バックエンド（Bun + Hono）

- [x] バックエンド変更なし

### データ/公開

- [x] PostgreSQL、Cloudflare Access、Tunnel、環境変数の変更なし

### 品質

- [x] ESLint / 型チェックを通過
- [x] コンソールエラー/警告を確認
- [x] パフォーマンス/コストへの影響なし
- [x] セキュリティへの影響なし

### ドキュメント/運用

- [x] AGENTS.md、README、仕様書の更新不要を確認
- [x] 動作確認手順と期待結果を本文に記載
- [x] UI変更がないためスクリーンショット/動画は不要
```

Create the Draft PR through the GitHub connector with:

- repository: `Kawatan1927/cooking-planner`
- base: `main`
- head: `feature/150-add-shopping-list-frontend-tests`
- draft: `true`
- label: `enhancement`

Expected: Draft PR is created, its title exactly matches Issue #150, and its body contains `closes #150`.
