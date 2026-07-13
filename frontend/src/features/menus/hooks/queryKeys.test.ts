import { describe, expect, it } from 'vitest';

import { menusQueryKeys } from './queryKeys';

describe('menusQueryKeys', () => {
  it('共通prefixをユーザーごとに分離する', () => {
    expect(menusQueryKeys.all('user-1')).toEqual(['menus', 'user-1']);
    expect(menusQueryKeys.all('user-1')).not.toEqual(menusQueryKeys.all('user-2'));
  });

  it('一覧をユーザーと検索期間ごとに分離する', () => {
    expect(menusQueryKeys.list('user-1', '2026-07-01', '2026-07-07')).toEqual([
      'menus',
      'user-1',
      '2026-07-01',
      '2026-07-07',
    ]);
    expect(menusQueryKeys.list('user-1', '2026-07-01', '2026-07-07')).not.toEqual(
      menusQueryKeys.list('user-1', '2026-07-08', '2026-07-14')
    );
    expect(menusQueryKeys.list('user-1', '2026-07-01', '2026-07-07')).not.toEqual(
      menusQueryKeys.list('user-2', '2026-07-01', '2026-07-07')
    );
  });

  it('検索期間未指定をnullで表す', () => {
    expect(menusQueryKeys.list('user-1')).toEqual(['menus', 'user-1', null, null]);
  });
});
