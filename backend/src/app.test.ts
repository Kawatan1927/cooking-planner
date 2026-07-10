import { describe, expect, it } from 'vitest';
// Bun シムと FRONTEND_DIST_DIR は test-utils/vitest.setup.ts で準備済み
import app from './app';

describe('app route prefixes', () => {
  it('/api prefix でも health endpoint を公開する', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});

describe('frontend static delivery', () => {
  it('非 API ルートでは SPA の index.html を返す', async () => {
    const response = await app.request('/recipes', {
      headers: { Accept: 'text/html' },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(await response.text()).toContain('Cooking Planner');
  });

  it('静的アセットを frontend/dist から返す', async () => {
    const response = await app.request('/assets/app.js');

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('cooking planner');
  });

  it('存在しない静的アセットでは SPA の index.html を返さない', async () => {
    const response = await app.request('/assets/missing.js');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        details: null,
      },
    });
  });

  it('favicon が存在しない場合は SPA の index.html を返さない', async () => {
    const response = await app.request('/favicon.ico');

    expect(response.status).toBe(404);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: {
        code: 'NOT_FOUND',
        message: 'Endpoint not found',
        details: null,
      },
    });
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
