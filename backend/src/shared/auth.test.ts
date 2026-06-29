import { Hono } from 'hono';
import type { JsonWebKey } from 'crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { authMiddleware, getUserId } from './auth';

const originalEnv = { ...process.env };

const encodeBase64Url = (input: ArrayBuffer | Uint8Array | string): string => {
  const bytes =
    typeof input === 'string'
      ? new TextEncoder().encode(input)
      : input instanceof Uint8Array
        ? input
        : new Uint8Array(input);
  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/u, '');
};

const createSignedJwt = async ({
  keyPair,
  kid,
  payload,
}: {
  keyPair: CryptoKeyPair;
  kid: string;
  payload: Record<string, unknown>;
}): Promise<string> => {
  const header = encodeBase64Url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const body = encodeBase64Url(JSON.stringify(payload));
  const signingInput = `${header}.${body}`;
  const signature = await crypto.subtle.sign(
    'RSASSA-PKCS1-v1_5',
    keyPair.privateKey,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${encodeBase64Url(signature)}`;
};

const exportPublicJwk = async (keyPair: CryptoKeyPair, kid: string): Promise<JsonWebKey> => {
  const jwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  return { ...jwk, kid, alg: 'RS256', use: 'sig' };
};

describe('authMiddleware', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
    delete process.env.DEV_USER_ID;
    delete process.env.CLOUDFLARE_ACCESS_TEAM_NAME;
    delete process.env.CLOUDFLARE_ACCESS_AUD;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('DEV_USER_ID が指定されている場合は Cloudflare Access JWT なしで userId に使う', async () => {
    process.env.DEV_USER_ID = 'local-test-user';

    const app = new Hono();
    app.use('*', authMiddleware());
    app.get('/recipes', c => c.text(getUserId(c)));

    const response = await app.request('/recipes');

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('local-test-user');
  });

  it('Cloudflare Access JWT を検証し email を userId に使う', async () => {
    process.env.CLOUDFLARE_ACCESS_TEAM_NAME = 'my-team';
    process.env.CLOUDFLARE_ACCESS_AUD = 'app-audience';
    const kid = 'test-key';
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSASSA-PKCS1-v1_5',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256',
      },
      true,
      ['sign', 'verify']
    );
    const jwk = await exportPublicJwk(keyPair, kid);
    const jwt = await createSignedJwt({
      keyPair,
      kid,
      payload: {
        aud: ['app-audience'],
        email: 'user@example.com',
        exp: Math.floor(Date.now() / 1000) + 60,
        iat: Math.floor(Date.now() / 1000) - 60,
        iss: 'https://my-team.cloudflareaccess.com',
      },
    });
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      new Response(JSON.stringify({ keys: [jwk] }), {
        headers: { 'content-type': 'application/json' },
      })
    );

    const app = new Hono();
    app.use('*', authMiddleware());
    app.get('/recipes', c => c.text(getUserId(c)));

    const response = await app.request('/recipes', {
      headers: { 'Cf-Access-Jwt-Assertion': jwt },
    });

    expect(response.status).toBe(200);
    expect(await response.text()).toBe('user@example.com');
    expect(fetchMock).toHaveBeenCalledWith(
      'https://my-team.cloudflareaccess.com/cdn-cgi/access/certs'
    );
  });

  it('Cloudflare Access 設定がある場合は JWT がないリクエストを 401 にする', async () => {
    process.env.CLOUDFLARE_ACCESS_TEAM_NAME = 'my-team';
    process.env.CLOUDFLARE_ACCESS_AUD = 'app-audience';

    const app = new Hono();
    app.use('*', authMiddleware());
    app.get('/recipes', c => c.text(getUserId(c)));

    const response = await app.request('/recipes');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Cloudflare Access JWT is required',
      },
    });
  });

  it('DEV_USER_ID も Cloudflare Access 設定もない場合は 401 にする', async () => {
    const app = new Hono();
    app.use('*', authMiddleware());
    app.get('/recipes', c => c.text(getUserId(c)));

    const response = await app.request('/recipes');
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Cloudflare Access configuration is required',
      },
    });
  });

  it('認証コンテキストがない場合は getUserId がエラーにする', () => {
    const context = {
      get: () => undefined,
    };

    expect(() => getUserId(context as never)).toThrow('Authenticated userId is not available');
  });
});
