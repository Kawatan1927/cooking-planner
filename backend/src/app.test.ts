import { describe, expect, it } from 'vitest';
import app from './app';

describe('app route prefixes', () => {
  it('/api prefix でも health endpoint を公開する', async () => {
    const response = await app.request('/api/health');

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: 'ok' });
  });
});
