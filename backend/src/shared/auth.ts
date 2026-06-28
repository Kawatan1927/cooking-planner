import type { Context, MiddlewareHandler } from 'hono';
import type { JsonWebKey } from 'crypto';
import { errorResponse } from './http';
import { resultToResponse } from './adapt';

const USER_ID_CONTEXT_KEY = 'userId';
const ACCESS_JWT_HEADER = 'Cf-Access-Jwt-Assertion';
const DEFAULT_DEV_USER_ID = 'local-dev-user';

type CloudflareAccessPayload = {
  aud?: string | string[];
  email?: string;
  exp?: number;
  iat?: number;
  iss?: string;
  sub?: string;
};

type JsonWebKeySet = {
  keys?: JsonWebKey[];
};

const textEncoder = new TextEncoder();

const base64UrlToBytes = (value: string): Uint8Array => {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  return Uint8Array.from(Buffer.from(padded, 'base64'));
};

const decodeJsonPart = <T>(value: string): T => {
  const bytes = base64UrlToBytes(value);
  return JSON.parse(new TextDecoder().decode(bytes)) as T;
};

const getCloudflareAccessConfig = () => {
  const teamName = process.env.CLOUDFLARE_ACCESS_TEAM_NAME;
  const audience = process.env.CLOUDFLARE_ACCESS_AUD;

  if (!teamName || !audience) {
    return null;
  }

  return {
    audience,
    issuer: `https://${teamName}.cloudflareaccess.com`,
    jwksUrl: `https://${teamName}.cloudflareaccess.com/cdn-cgi/access/certs`,
  };
};

const fetchJwks = async (jwksUrl: string): Promise<JsonWebKeySet> => {
  const response = await fetch(jwksUrl);
  if (!response.ok) {
    throw new Error(`Failed to fetch Cloudflare Access certs: ${response.status}`);
  }
  return (await response.json()) as JsonWebKeySet;
};

const audienceMatches = (actual: string | string[] | undefined, expected: string): boolean => {
  if (Array.isArray(actual)) {
    return actual.includes(expected);
  }
  return actual === expected;
};

const verifyCloudflareAccessJwt = async (jwt: string): Promise<string> => {
  const config = getCloudflareAccessConfig();
  if (!config) {
    return process.env.DEV_USER_ID ?? DEFAULT_DEV_USER_ID;
  }

  const parts = jwt.split('.');
  if (parts.length !== 3) {
    throw new Error('Invalid Cloudflare Access JWT format');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = parts;
  const header = decodeJsonPart<{ alg?: string; kid?: string }>(encodedHeader);
  const payload = decodeJsonPart<CloudflareAccessPayload>(encodedPayload);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Unsupported Cloudflare Access JWT header');
  }

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== 'number' || payload.exp <= now) {
    throw new Error('Cloudflare Access JWT has expired');
  }
  if (payload.iss !== config.issuer) {
    throw new Error('Cloudflare Access JWT issuer mismatch');
  }
  if (!audienceMatches(payload.aud, config.audience)) {
    throw new Error('Cloudflare Access JWT audience mismatch');
  }

  const jwks = await fetchJwks(config.jwksUrl);
  const jwk = jwks.keys?.find(key => key.kid === header.kid);
  if (!jwk) {
    throw new Error('Cloudflare Access signing key not found');
  }

  const publicKey = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify']
  );
  const verified = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    publicKey,
    base64UrlToBytes(encodedSignature),
    textEncoder.encode(`${encodedHeader}.${encodedPayload}`)
  );
  if (!verified) {
    throw new Error('Cloudflare Access JWT signature verification failed');
  }

  const userId = payload.email || payload.sub;
  if (!userId) {
    throw new Error('Cloudflare Access JWT does not contain email or sub');
  }

  return userId;
};

export const authMiddleware = (): MiddlewareHandler => async (c, next) => {
  const devUserId = process.env.DEV_USER_ID;
  if (devUserId) {
    c.set(USER_ID_CONTEXT_KEY, devUserId);
    await next();
    return undefined;
  }

  const config = getCloudflareAccessConfig();
  if (!config) {
    c.set(USER_ID_CONTEXT_KEY, DEFAULT_DEV_USER_ID);
    await next();
    return undefined;
  }

  const jwt = c.req.header(ACCESS_JWT_HEADER);
  if (!jwt) {
    return resultToResponse(
      errorResponse(401, 'UNAUTHORIZED', 'Cloudflare Access JWT is required')
    );
  }

  try {
    c.set(USER_ID_CONTEXT_KEY, await verifyCloudflareAccessJwt(jwt));
  } catch {
    return resultToResponse(errorResponse(401, 'UNAUTHORIZED', 'Cloudflare Access JWT is invalid'));
  }

  await next();
  return undefined;
};

/**
 * リクエストから userId を取得する。
 *
 * 本番では `authMiddleware()` が Cloudflare Access JWT を検証し、
 * JWT の `email`（なければ `sub`）を userId として Hono context に設定する。
 * ローカル開発では `DEV_USER_ID`、未指定時は `local-dev-user` を使う。
 */
export const getUserId = (c: Context): string =>
  (c.get(USER_ID_CONTEXT_KEY) as string | undefined) ??
  process.env.DEV_USER_ID ??
  DEFAULT_DEV_USER_ID;
