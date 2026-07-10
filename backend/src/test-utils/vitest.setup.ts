import { afterAll } from 'vitest';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { installBunStaticShim } from './bun-static-shim';

// app モジュールは import 時に Bun グローバルと FRONTEND_DIST_DIR を参照するため、
// テストファイルの読み込み前（setupFiles 実行時）に準備する。
installBunStaticShim();

const frontendDistDir = await mkdtemp(join(tmpdir(), 'cooking-planner-frontend-dist-'));
const assetsDir = join(frontendDistDir, 'assets');

await mkdir(assetsDir, { recursive: true });
await writeFile(
  join(frontendDistDir, 'index.html'),
  '<!doctype html><html><body><div id="root">Cooking Planner</div></body></html>'
);
await writeFile(join(assetsDir, 'app.js'), 'console.log("cooking planner");');

process.env.FRONTEND_DIST_DIR = frontendDistDir;

afterAll(async () => {
  await rm(frontendDistDir, { recursive: true, force: true });
});
