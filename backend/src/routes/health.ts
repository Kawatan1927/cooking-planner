import { Hono } from 'hono';
import { adapt } from '../shared/adapt';
import { jsonResponse } from '../shared/http';

/**
 * GET /health
 * 認証不要の疎通確認エンドポイント。
 */
const health = new Hono();

health.get(
  '/',
  adapt(() => jsonResponse(200, { status: 'ok', time: new Date().toISOString() }))
);

export default health;
