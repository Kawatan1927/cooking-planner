import { describe, expect, it } from 'vitest';

import { getUserCacheKey } from './queryKeyUtils';

describe('getUserCacheKey', () => {
  it('指定したユーザーキーを返す', () => {
    expect(getUserCacheKey('user-1')).toBe('user-1');
  });

  it.each([undefined, null, ''])('%sの場合は既定キーを返す', userKey => {
    expect(getUserCacheKey(userKey)).toBe('cloudflare-access-user');
  });
});
