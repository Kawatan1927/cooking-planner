# フロントエンド単体テスト基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Vitest と React Testing Library により、フロントエンドのコンポーネントと React Query hooks をローカル・CI で安定してテスト可能にする。

**Architecture:** `frontend/vite.config.ts` に Vitest の jsdom 設定を追加する。`src/test/` は matcher 登録、テスト後処理、テスト専用 QueryClient・MemoryRouter を作成する Provider helper に責務を分ける。テストは共有アプリ状態を使わず、API ラッパーを Vitest mock で差し替える。

**Tech Stack:** Bun, Vite, Vitest, jsdom, React 19, React Testing Library, user-event, TanStack Query 5, React Router 7, TypeScript

## Global Constraints

- `docs/01-vision-and-scope.md` から `docs/05-architecture-notes.md` は変更しない。
- API を実ネットワークへ接続せず、`vi.mock` で API ラッパーを差し替える。
- 画面テストは利用者に見えるテキスト・操作を検証し、CSS、レイアウト、スナップショット、非公開実装は検証しない。
- 各テストは新しい QueryClient を使い、`afterEach` で DOM と mock を初期化する。
- 新しいテストコードは TypeScript の strict 設定と Prettier 設定に従う。

---

## File Structure

- Modify: `frontend/package.json`, `frontend/bun.lock`, `frontend/vite.config.ts`
  - テスト依存、スクリプト、jsdom の Vitest 設定を追加する。
- Create: `frontend/src/test/setup.ts`, `frontend/src/test/renderWithProviders.tsx`
  - `setup.ts` は Task 1 で空の設定ファイルとして追加し、Task 2 で matcher と後処理を実装する。Provider helper は Task 2 で追加する。
- Create: `frontend/src/features/recipes/pages/RecipeListPage.test.tsx`, `frontend/src/features/recipes/hooks/useRecipes.test.tsx`
  - API mock を使うコンポーネントと hook の利用例を提供する。
- Modify: `package.json`, `.github/workflows/frontend-ci.yml`
  - ルートと CI でフロントエンドテストを実行する。
- Modify: `frontend/AGENTS.md`, `docs/docs/development/testing.mdx`
  - テスト実行コマンドと方針を文書化する。

### Task 1: Vitest を導入しテストランナーを設定する

**Files:**

- Modify: `frontend/package.json`
- Modify: `frontend/bun.lock`
- Modify: `frontend/vite.config.ts`
- Create: `frontend/src/test/setup.ts`

**Produces:** `bun run test` と `bun run test:watch`、jsdom 上で `src/**/*.test.{ts,tsx}` を実行する Vitest 設定。

- [ ] **Step 1: Add test dependencies and scripts**

Run:

```bash
cd frontend
bun add -d vitest jsdom @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

Then add these entries to the existing `scripts` object in `frontend/package.json`:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Keep all existing scripts and commit Bun's resolved versions in `frontend/bun.lock`.

Create the empty setup file required by the runner:

```ts
export {}
```

- [ ] **Step 2: Configure Vitest for the existing Vite project**

Replace the `defineConfig` import and retain the existing plugin and aliases while adding the `test` block:

```ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@features': path.resolve(__dirname, './src/features'),
      '@lib': path.resolve(__dirname, './src/lib'),
      '@components': path.resolve(__dirname, './src/components'),
    },
  },
  test: {
    environment: 'jsdom',
    passWithNoTests: true,
    setupFiles: './src/test/setup.ts',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
```

- [ ] **Step 3: Confirm the runner discovers no tests yet**

Run:

```bash
cd frontend
bun run test
```

Expected: Vitest loads successfully, reports that no test files have been found, and exits with status 0.

- [ ] **Step 4: Commit the runner configuration**

Run:

```bash
git add frontend/package.json frontend/bun.lock frontend/vite.config.ts frontend/src/test/setup.ts
git commit -m "test: Vitest実行環境を追加"
```

### Task 2: テスト用 Provider helper と後処理を実装する

**Files:**

- Create: `frontend/src/test/setup.ts`
- Create: `frontend/src/test/renderWithProviders.tsx`
- Create: `frontend/src/features/recipes/pages/RecipeListPage.test.tsx`

**Consumes:** Task 1 の jsdom 環境、React Testing Library、TanStack Query、React Router。

**Produces:** `createTestQueryClient`, `createTestWrapper`, `renderWithProviders`。コンポーネントテストは `renderWithProviders`、hook テストは `createTestWrapper` を使用できる。

- [ ] **Step 1: Write the failing component test that imports the helper**

Create `frontend/src/features/recipes/pages/RecipeListPage.test.tsx`:

```tsx
import { screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getRecipes } from '../api/recipes'
import { renderWithProviders } from '../../../test/renderWithProviders'
import { RecipeListPage } from './RecipeListPage'

vi.mock('../api/recipes', () => ({ getRecipes: vi.fn() }))

const mockedGetRecipes = vi.mocked(getRecipes)

describe('RecipeListPage', () => {
  it('取得したレシピ名を表示する', async () => {
    mockedGetRecipes.mockResolvedValue([
      {
        recipeId: 'recipe-1', name: '鶏の照り焼き', sourceBook: null,
        sourcePage: null, baseServings: 2,
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      },
    ])

    renderWithProviders(<RecipeListPage />)

    expect(await screen.findByText('鶏の照り焼き')).toBeInTheDocument()
    expect(mockedGetRecipes).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the test and verify the missing helper fails**

Run:

```bash
cd frontend
bun run test -- RecipeListPage.test.tsx
```

Expected: FAIL because `src/test/setup.ts` and `src/test/renderWithProviders.tsx` do not exist yet.

- [ ] **Step 3: Add matcher registration and per-test cleanup**

Create `frontend/src/test/setup.ts`:

```ts
import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})
```

- [ ] **Step 4: Add a provider helper that creates isolated state**

Create `frontend/src/test/renderWithProviders.tsx`:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, type RenderOptions } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import type { PropsWithChildren, ReactElement } from 'react'

interface ProviderOptions { route?: string; queryClient?: QueryClient }
type RenderWithProvidersOptions = Omit<RenderOptions, 'wrapper'> & ProviderOptions

export function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
}

export function createTestWrapper({ route = '/', queryClient = createTestQueryClient() }: ProviderOptions = {}) {
  return function TestWrapper({ children }: PropsWithChildren) {
    return <QueryClientProvider client={queryClient}><MemoryRouter initialEntries={[route]}>{children}</MemoryRouter></QueryClientProvider>
  }
}

export function renderWithProviders(ui: ReactElement, { route, queryClient = createTestQueryClient(), ...options }: RenderWithProvidersOptions = {}) {
  return { queryClient, ...render(ui, { wrapper: createTestWrapper({ route, queryClient }), ...options }) }
}
```

- [ ] **Step 5: Run the component test and verify it passes**

Run:

```bash
cd frontend
bun run test -- RecipeListPage.test.tsx
```

Expected: PASS. The test waits for the visible recipe name and does not issue a network request.

- [ ] **Step 6: Commit the helper foundation**

Run:

```bash
git add frontend/src/test/setup.ts frontend/src/test/renderWithProviders.tsx frontend/src/features/recipes/pages/RecipeListPage.test.tsx
git commit -m "test: Provider共通helperを追加"
```

### Task 3: React Query hook でも共通 helper を検証する

**Files:**

- Create: `frontend/src/features/recipes/hooks/useRecipes.test.tsx`

**Consumes:** `useRecipes`, `getRecipes`, `createTestQueryClient`, `createTestWrapper`。

**Produces:** hook テスト用 wrapper の使用例。新規 QueryClient により、コンポーネントテストからキャッシュや mock が共有されない。

- [ ] **Step 1: Write the hook test**

Create `frontend/src/features/recipes/hooks/useRecipes.test.tsx`:

```tsx
import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { getRecipes } from '../api/recipes'
import { createTestQueryClient, createTestWrapper } from '../../../test/renderWithProviders'
import { useRecipes } from './useRecipes'

vi.mock('../api/recipes', () => ({ getRecipes: vi.fn() }))

const mockedGetRecipes = vi.mocked(getRecipes)

describe('useRecipes', () => {
  it('APIから取得したレシピ一覧を返す', async () => {
    mockedGetRecipes.mockResolvedValue([
      {
        recipeId: 'recipe-2', name: '野菜スープ', sourceBook: null,
        sourcePage: null, baseServings: 2,
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      },
    ])
    const queryClient = createTestQueryClient()

    const { result } = renderHook(() => useRecipes(), {
      wrapper: createTestWrapper({ queryClient }),
    })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toEqual([
      expect.objectContaining({ recipeId: 'recipe-2', name: '野菜スープ' }),
    ])
    expect(mockedGetRecipes).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run all frontend unit tests**

Run:

```bash
cd frontend
bun run test
```

Expected: Both `RecipeListPage.test.tsx` and `useRecipes.test.tsx` pass. Run the command twice; the second run must produce the same result, showing that QueryClient and mock state do not leak.

- [ ] **Step 3: Confirm watch mode starts**

Run:

```bash
cd frontend
bun run test:watch -- --run
```

Expected: Vitest accepts the watch-mode script and executes the same two passing tests when `--run` is supplied.

- [ ] **Step 4: Commit the hook example**

Run:

```bash
git add frontend/src/features/recipes/hooks/useRecipes.test.tsx
git commit -m "test: React Query hookのテスト例を追加"
```

### Task 4: ルートコマンド、CI、ドキュメントを同期する

**Files:**

- Modify: `package.json`
- Modify: `.github/workflows/frontend-ci.yml`
- Modify: `frontend/AGENTS.md`
- Modify: `docs/docs/development/testing.mdx`

**Consumes:** Task 1 の `frontend` 内 `test` / `test:watch` スクリプト。

**Produces:** ローカル、pre-push、GitHub Actions、開発ドキュメントで一致するテスト実行方法。

- [ ] **Step 1: Add root test wrappers**

In the root `package.json`, add these scripts and replace the existing root `test` script:

```json
"frontend:test": "cd frontend && bun run test",
"frontend:test:watch": "cd frontend && bun run test:watch",
"test": "bun run frontend:test && bun run backend:test"
```

This makes the existing lefthook `pre-push` command include frontend tests whenever `frontend/**` changes.

- [ ] **Step 2: Run frontend tests in GitHub Actions**

Add this step to `.github/workflows/frontend-ci.yml` after the Prettier check and before the build step:

```yaml
    - name: 単体テストの実行
      working-directory: ./frontend
      run: bun run test
```

- [ ] **Step 3: Document the supported commands**

Add these lines to the command list in `frontend/AGENTS.md`:

```md
- `bun run test`
- `bun run test:watch`
```

Replace the frontend section of `docs/docs/development/testing.mdx` with the following text, retaining the backend section:

````mdx
### フロントエンド

Vitest、jsdom、React Testing Library を使用します。テストは実ネットワークに接続せず、API ラッパーを mock します。

```bash
# リポジトリ全体
bun run test

# フロントエンドのみ
bun run frontend:test

# フロントエンドの watch モード
bun run frontend:test:watch
```

- 画面の表示や操作など、利用者から観測できる振る舞いを検証します。
- React Query hooks とコンポーネントは `src/test/renderWithProviders.tsx` の helper を使います。
- 各テストは独立した QueryClient を使い、テスト終了後に DOM と mock を初期化します。
````

- [ ] **Step 4: Verify the focused and common checks**

Run:

```bash
bun run frontend:test
bun run lint
bun run format:check
bun run type-check
bun run build:all
cd docs && bun run build
```

Expected: Every command exits with status 0. The docs build validates the edited MDX, and the root checks match the repository PR requirements.

- [ ] **Step 5: Commit command, CI, and documentation updates**

Run:

```bash
git add package.json .github/workflows/frontend-ci.yml frontend/AGENTS.md docs/docs/development/testing.mdx
git commit -m "test: フロントエンド単体テストをCIで実行"
```

### Task 5: 最終確認とPR作成を行う

**Files:** No source edits in this task.

- [ ] **Step 1: Verify only Issue #145 files are included**

Run:

```bash
git status --short
git log --oneline origin/main..HEAD
git diff --check origin/main...HEAD
```

Expected: 作業ツリーがクリーンで、Issue #145 のテスト基盤・補助設計書・実装計画だけがブランチ差分に含まれる。

- [ ] **Step 2: Run the exact PR checks**

Run:

```bash
cd frontend && bun install --frozen-lockfile && cd ..
cd docs && bun install --frozen-lockfile && cd ..
bun run lint
bun run format:check
bun run type-check
bun run build:all
bun run test
```

Expected: All commands pass. `bun run test` executes both the frontend Vitest suite and the existing backend suite.

- [ ] **Step 3: Push the branch and open a draft PR**

Use the GitHub connector to create a draft PR with this metadata:

```text
Title: フロントエンド単体テスト基盤を整備する
Base: main
Head: feature/145-frontend-unit-test-foundation
Label: enhancement
Related issue: closes #145
```

Populate the PR body from `.github/PULL_REQUEST_TEMPLATE.md`. State that this changes test infrastructure only, adds no user-visible behavior, and does not alter the five source-of-truth specification documents.

## Self-Review

- Spec coverage: 依存導入、test/watch、Vitest 設定、共通 Provider helper、component/hook の使用例、状態分離、CI、AGENTS、Docusaurus 文書、PR チェックを各タスクで扱う。
- Placeholder scan: 実装するファイル、コード、コマンド、成功条件をすべて記載し、未決定項目は含めない。
- Type consistency: `createTestQueryClient` と `createTestWrapper` は Task 2 で公開し、Task 3 の `renderHook` が同じ関数名で利用する。
