import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./routes/health', async () => {
  const { Hono } = await import('hono');
  const route = new Hono();
  route.get('/', () => {
    throw new Error('test handler error');
  });
  return { default: route };
});

import app from './app';

describe('app error handling', () => {
  afterEach(() => vi.restoreAllMocks());

  it('handler例外を既定の500エラー形式へ変換する', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const response = await app.request('/api/health');

    expect(response.status).toBe(500);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalledWith('Unhandled error:', expect.any(Error));
  });
});
