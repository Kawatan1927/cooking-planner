import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { Blob } from 'node:buffer';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const originalFrontendDistDir = process.env.FRONTEND_DIST_DIR;

let frontendDistDir: string;
let app: (typeof import('./app'))['default'];

type BunFile = Blob & { exists: () => Promise<boolean> };
type BunStaticRuntime = {
  file: (path: string) => BunFile;
  write: (path: string, data: string | Blob) => Promise<void>;
};

const installBunStaticShim = (): void => {
  const runtimeGlobal = globalThis as typeof globalThis & {
    Bun?: BunStaticRuntime;
  };

  runtimeGlobal.Bun ??= {
    file: path =>
      Object.assign(new Blob(existsSync(path) ? [readFileSync(path)] : []), {
        exists: async () => existsSync(path),
      }),
    write: async (path, data) => {
      await writeFile(path, data instanceof Blob ? Buffer.from(await data.arrayBuffer()) : data);
    },
  };
};

beforeAll(async () => {
  installBunStaticShim();

  frontendDistDir = await mkdtemp(join(tmpdir(), 'cooking-planner-frontend-dist-'));
  const assetsDir = join(frontendDistDir, 'assets');

  await mkdir(assetsDir, { recursive: true });
  await writeFile(
    join(frontendDistDir, 'index.html'),
    '<!doctype html><html><body><div id="root">Cooking Planner</div></body></html>'
  );
  await writeFile(join(assetsDir, 'app.js'), 'console.log("cooking planner");');

  process.env.FRONTEND_DIST_DIR = frontendDistDir;
  ({ default: app } = await import('./app'));
});

afterAll(async () => {
  if (originalFrontendDistDir === undefined) {
    delete process.env.FRONTEND_DIST_DIR;
  } else {
    process.env.FRONTEND_DIST_DIR = originalFrontendDistDir;
  }

  if (frontendDistDir) {
    await rm(frontendDistDir, { recursive: true, force: true });
  }
});

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
