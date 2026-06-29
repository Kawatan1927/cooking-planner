# ローカル Hono フロントエンド配信 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Hono バックエンドで `frontend/dist/` を配信し、`/api/*` 以外の直接 URL アクセスを React SPA にフォールバックさせる。

**Architecture:** `backend/src/app.ts` で API を `/api/*` に集約し、未知の `/api/*` は JSON 404 を返す。その後に `hono/bun` の `serveStatic` を登録して静的ファイルを配信し、最後に非 API の GET リクエストを `frontend/dist/index.html` へフォールバックさせる。

**Tech Stack:** Bun, Hono, `hono/bun` `serveStatic`, Vitest, Vite + React, TypeScript

---

## File Structure

- Modify: `backend/src/app.ts`
  - 非 `/api` の業務 API 登録をやめ、`/api/*` を正規 API にする。
  - `/health` と `/api/health` は維持する。
  - 未知の `/api/*` を JSON 404 に固定する。
  - `frontend/dist/` の静的配信と SPA フォールバックを追加する。
- Modify: `backend/src/app.test.ts`
  - テスト用に `frontend/dist/index.html` と静的アセットを作成する。
  - SPA フォールバック、静的配信、API JSON 404 を検証する。
- Modify: `frontend/.env.example`
  - CloudFront と Cognito の古い説明を削除する。
  - ローカル Hono API の `VITE_API_BASE_URL=http://localhost:3000/api` を記載する。
- Create: `frontend/.env.production.example`
  - Cloudflare Tunnel で同一オリジン配信する `VITE_API_BASE_URL=/api` を記載する。

---

### Task 1: SPA 配信の RED テストを追加する

**Files:**
- Modify: `backend/src/app.test.ts`

- [ ] **Step 1: Write the failing test**

Replace `backend/src/app.test.ts` with:

```ts
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import app from './app';

const frontendDistDir = join(process.cwd(), '..', 'frontend', 'dist');
const assetsDir = join(frontendDistDir, 'assets');

describe('app route prefixes', () => {
  it('/api prefix でも health endpoint を公開する', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});

describe('frontend static delivery', () => {
  beforeAll(async () => {
    await mkdir(assetsDir, { recursive: true });
    await writeFile(
      join(frontendDistDir, 'index.html'),
      '<!doctype html><html><body><div id="root">Cooking Planner</div></body></html>'
    );
    await writeFile(join(assetsDir, 'app.js'), 'console.log("cooking planner");');
  });

  afterAll(async () => {
    await rm(frontendDistDir, { recursive: true, force: true });
  });

  it('非 API ルートでは SPA の index.html を返す', async () => {
    const response = await app.request('/recipes');

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('Cooking Planner');
  });

  it('静的アセットを frontend/dist から返す', async () => {
    const response = await app.request('/assets/app.js');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('cooking planner');
  });

  it('未定義の /api/* は JSON 404 を返し SPA にフォールバックしない', async () => {
    const response = await app.request('/api/unknown');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Endpoint not found',
        details: null,
      },
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
bun run backend:test -- app.test.ts
```

Expected:

- `/api prefix でも health endpoint を公開する` passes.
- `非 API ルートでは SPA の index.html を返す` fails because `/recipes` is still registered as an API route or returns JSON/not found instead of HTML.
- `静的アセットを frontend/dist から返す` fails because static serving is not implemented.

---

### Task 2: Hono に静的配信と SPA フォールバックを追加する

**Files:**
- Modify: `backend/src/app.ts`

- [ ] **Step 1: Write minimal implementation**

Update `backend/src/app.ts` to this structure:

```ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serveStatic } from 'hono/bun';
import health from './routes/health';
import recipes from './routes/recipes';
import menus from './routes/menus';
import shoppingList from './routes/shoppingList';
import { internalServerError, notFound } from './shared/http';
import { resultToResponse } from './shared/adapt';
import { authMiddleware } from './shared/auth';

/**
 * 開発フロント（Vite dev server）のオリジン。
 * 本番はフロントと API が同一オリジンのため CORS は不要だが、
 * ローカル開発（フロント :5173 / API :3000）では必要。
 * @see docs/05-architecture-notes.md §8.1
 */
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? 'http://localhost:5173';

const FRONTEND_DIST_DIR = '../frontend/dist';
const FRONTEND_INDEX_HTML = `${FRONTEND_DIST_DIR}/index.html`;

const app = new Hono();

app.use(
  '*',
  cors({
    origin: FRONTEND_ORIGIN,
    allowHeaders: ['Content-Type'],
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  })
);

const protectedPaths = [
  '/api/recipes',
  '/api/recipes/*',
  '/api/menus',
  '/api/menus/*',
  '/api/shopping-list',
  '/api/shopping-list/*',
] as const;

for (const path of protectedPaths) {
  app.use(path, authMiddleware());
}

const registerRoutes = (basePath = ''): void => {
  app.route(`${basePath}/health`, health);
  app.route(`${basePath}/recipes`, recipes);
  app.route(`${basePath}/menus`, menus);
  app.route(`${basePath}/shopping-list`, shoppingList);
};

app.route('/health', health);
registerRoutes('/api');

app.all('/api/*', () => resultToResponse(notFound('Endpoint not found')));

app.use('*', serveStatic({ root: FRONTEND_DIST_DIR }));
app.get('*', serveStatic({ path: FRONTEND_INDEX_HTML }));

// 未定義の非 API ルートは SPA フォールバックで処理する。
// 静的ファイルが存在しない場合のみ docs/04-api-design.md のエラー形式で 404 を返す。
app.notFound(() => resultToResponse(notFound('Endpoint not found')));

// 想定外の例外は 500 に集約する
app.onError((err, _c) => {
  console.error('Unhandled error:', err);
  return resultToResponse(internalServerError('An unexpected error occurred'));
});

export default app;
```

- [ ] **Step 2: Run test to verify it passes**

Run:

```bash
bun run backend:test -- app.test.ts
```

Expected:

- All tests in `backend/src/app.test.ts` pass.

- [ ] **Step 3: Run backend type-check**

Run:

```bash
bun run backend:type-check
```

Expected:

- TypeScript reports no errors.

---

### Task 3: フロントエンド環境変数サンプルを更新する

**Files:**
- Modify: `frontend/.env.example`
- Create: `frontend/.env.production.example`

- [ ] **Step 1: Update development env example**

Replace `frontend/.env.example` with:

```env
# ローカル開発用 API ベース URL
# backend の Hono サーバーを `bun run backend:dev` または `bun run backend:start` で起動して使う。
VITE_API_BASE_URL=http://localhost:3000/api
```

- [ ] **Step 2: Add production env example**

Create `frontend/.env.production.example`:

```env
# Cloudflare Tunnel 経由の同一オリジン配信用 API ベース URL
# フロントエンドと API を同じ Hono サーバーから配信するため、相対パスを使う。
VITE_API_BASE_URL=/api
```

- [ ] **Step 3: Run frontend format check**

Run:

```bash
bun run frontend:format:check
```

Expected:

- Prettier check passes.

---

### Task 4: リポジトリ全体の検証を実行する

**Files:**
- No source edits in this task.

- [ ] **Step 1: Run targeted backend tests**

Run:

```bash
bun run backend:test -- app.test.ts
```

Expected:

- `backend/src/app.test.ts` passes.

- [ ] **Step 2: Run all backend tests**

Run:

```bash
bun run backend:test
```

Expected:

- All backend tests pass.

- [ ] **Step 3: Run common PR checks**

Run:

```bash
bun run lint
bun run format:check
bun run type-check
bun run build:all
```

Expected:

- All commands exit successfully.

---

### Task 5: 変更をコミットする

**Files:**
- Include:
  - `backend/src/app.ts`
  - `backend/src/app.test.ts`
  - `frontend/.env.example`
  - `frontend/.env.production.example`
  - `docs/superpowers/plans/2026-06-29-local-hono-static-frontend.md`
- Exclude:
  - `.serena/project.yml`

- [ ] **Step 1: Check status**

Run:

```bash
git status --short
```

Expected:

- `.serena/project.yml` may be modified but remains unstaged.
- Only files from this issue are staged in the next step.

- [ ] **Step 2: Stage issue files only**

Run:

```bash
git add backend/src/app.ts backend/src/app.test.ts frontend/.env.example frontend/.env.production.example docs/superpowers/plans/2026-06-29-local-hono-static-frontend.md
```

- [ ] **Step 3: Commit**

Run:

```bash
git commit -m "feat: Honoでフロントエンドを配信" -m "- frontend/dist の静的配信と SPA フォールバックを追加
- API ルートを /api 配下に整理し、未知の /api は JSON 404 を維持
- ローカル配信用のフロントエンド環境変数サンプルを更新"
```

Expected:

- Commit succeeds on `feature/130-local-hono-static-frontend`.

---

## Self-Review

- Spec coverage: Hono 静的配信、SPA フォールバック、`/api/*` の JSON 404、環境変数サンプル更新、テスト追加を各タスクで扱っている。
- Placeholder scan: 未記入の手順や後回しの項目はない。
- Type consistency: `FRONTEND_DIST_DIR`、`FRONTEND_INDEX_HTML`、`protectedPaths`、`registerRoutes` は Task 2 内で定義してから使用している。
