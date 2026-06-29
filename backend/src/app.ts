import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { cors } from 'hono/cors';
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
const FRONTEND_DIST_DIR = process.env.FRONTEND_DIST_DIR ?? '../frontend/dist';
const FRONTEND_INDEX_HTML = 'index.html';
const spaFallback = serveStatic({ root: FRONTEND_DIST_DIR, path: FRONTEND_INDEX_HTML });

const isAssetLikePath = (path: string): boolean => {
  const lastSegment = path.split('/').at(-1) ?? '';
  return path.startsWith('/assets/') || lastSegment.includes('.');
};

const acceptsHtml = (acceptHeader: string | undefined): boolean =>
  acceptHeader?.split(',').some(value => value.trim().startsWith('text/html')) ?? false;

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

app.route('/health', health);
app.route('/api/health', health);
app.route('/api/recipes', recipes);
app.route('/api/menus', menus);
app.route('/api/shopping-list', shoppingList);
app.all('/api/*', () => resultToResponse(notFound('Endpoint not found', 'RESOURCE_NOT_FOUND')));

app.use('*', serveStatic({ root: FRONTEND_DIST_DIR }));
app.get('*', async (c, next) => {
  if (!acceptsHtml(c.req.header('Accept')) || isAssetLikePath(c.req.path)) {
    return resultToResponse(notFound('Endpoint not found'));
  }

  return spaFallback(c, next);
});

// 未定義ルートは docs/04-api-design.md のエラー形式で 404 を返す
app.notFound(() => resultToResponse(notFound('Endpoint not found')));

// 想定外の例外は 500 に集約する
app.onError((err, _c) => {
  console.error('Unhandled error:', err);
  return resultToResponse(internalServerError('An unexpected error occurred'));
});

export default app;
