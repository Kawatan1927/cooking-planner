const MENUS_QUERY_SCOPE = 'menus';

const hashString = (value: string): string => {
  let hash = 5381;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const payloadJson = atob(padded);
    const payload = JSON.parse(payloadJson);
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
};

export const getUserCacheKey = (token: string | null, userCacheKey?: string | null): string => {
  if (userCacheKey) {
    return userCacheKey;
  }

  if (!token) {
    return 'anonymous';
  }

  const payload = decodeJwtPayload(token);
  const sub = payload?.sub;
  if (typeof sub === 'string' && sub) {
    return `sub:${sub}`;
  }

  return `token:${hashString(token)}`;
};

export const menusQueryKeys = {
  all: (userKey: string) => [MENUS_QUERY_SCOPE, userKey] as const,
  list: (userKey: string, from?: string, to?: string) =>
    [MENUS_QUERY_SCOPE, userKey, from || null, to || null] as const,
};
