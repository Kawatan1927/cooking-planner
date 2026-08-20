/**
 * フレームワーク非依存のハンドラー戻り値。
 *
 * 各ドメインのハンドラーはこの `HandlerResult` を返し、`adapt()`（shared/adapt.ts）が
 * Hono の `Response` に変換する。これにより HTTP 層（Hono）とビジネスロジックを分離し、
 * 既存の `jsonResponse(status, body)` / `badRequest(message)` といった呼び出しを
 * そのまま維持できる。
 *
 * - `body` が `undefined` の場合はボディなし（例: 204 No Content）。
 * - エラー形式は `docs/docs/features/api-design.md` の `{ error: { code, message, details } }` に準拠。
 */
export interface HandlerResult {
  status: number;
  body?: unknown;
}

type ErrorDetails = unknown;

export const jsonResponse = (status: number, body: unknown): HandlerResult => ({
  status,
  body,
});

/** 204 No Content（ボディなし）を返す。 */
export const noContent = (): HandlerResult => ({ status: 204 });

export const errorResponse = (
  status: number,
  code: string,
  message: string,
  details: ErrorDetails = null
): HandlerResult => ({
  status,
  body: {
    error: {
      code,
      message,
      details,
    },
  },
});

export const badRequest = (message: string, code = 'BAD_REQUEST'): HandlerResult =>
  errorResponse(400, code, message);

export const notFound = (message: string, code = 'NOT_FOUND'): HandlerResult =>
  errorResponse(404, code, message);

export const internalServerError = (
  message: string,
  code = 'INTERNAL_SERVER_ERROR'
): HandlerResult => errorResponse(500, code, message);
