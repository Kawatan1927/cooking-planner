import type { Context } from 'hono';

/**
 * リクエストから userId を取得する。
 *
 * TODO(別Issue: 認証移行): 現状は認証ロジック移行までの「暫定スタブ」。
 *   本番では Cloudflare Access が前段で認証し、認証済みユーザー情報を
 *   ヘッダ（例: `Cf-Access-Authenticated-User-Email`）として注入する想定。
 *   認証移行 Issue では、この 1 関数だけを差し替えればよいように隔離している。
 *
 * 暫定挙動: 環境変数 `DEV_USER_ID`（未設定時は `local-dev-user`）を返す。
 */
export const getUserId = (_c: Context): string => process.env.DEV_USER_ID ?? 'local-dev-user';
