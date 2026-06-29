const DEFAULT_USER_CACHE_KEY = 'cloudflare-access-user';

export const getUserCacheKey = (userCacheKey?: string | null): string =>
  userCacheKey || DEFAULT_USER_CACHE_KEY;
