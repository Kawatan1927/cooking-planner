import type { Context } from 'hono';
import type { HandlerResult } from './http';

const JSON_CONTENT_TYPE = 'application/json; charset=utf-8';

/**
 * `HandlerResult` を Hono の `Response` に変換する。
 *
 * `Content-Type` は `docs/04-api-design.md` のレスポンス仕様に合わせて
 * `application/json; charset=utf-8` を明示する。
 */
export const resultToResponse = (result: HandlerResult): Response =>
  result.body === undefined
    ? new Response(null, { status: result.status })
    : new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { 'Content-Type': JSON_CONTENT_TYPE },
      });

/**
 * ドメインハンドラー（`(c) => HandlerResult`）を Hono のルートハンドラーに変換する。
 *
 * 使い方: `recipes.get('/', adapt(getRecipes))`
 */
export const adapt =
  (handler: (c: Context) => Promise<HandlerResult> | HandlerResult) =>
  async (c: Context): Promise<Response> =>
    resultToResponse(await handler(c));
