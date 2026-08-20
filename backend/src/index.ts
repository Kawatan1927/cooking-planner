import app from './app';

/**
 * Bun サーバーのエントリーポイント。
 *
 * - ポートは環境変数 `PORT`（デフォルト 3000）で設定可能。
 * - `docs/docs/architecture/backend.md` のセキュリティ方針に従い、
 *   ループバック（127.0.0.1）にのみバインドする。0.0.0.0 でバインドすると
 *   同一 LAN 内から Cloudflare Access を経由せず直接アクセスできてしまうため。
 *
 * Bun は `export default { port, hostname, fetch }` を `Bun.serve` の設定として扱う。
 */
const port = Number(process.env.PORT ?? 3000);

export default {
  port,
  hostname: '127.0.0.1',
  fetch: app.fetch,
};
