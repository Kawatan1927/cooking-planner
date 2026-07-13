import { describe, expect, it } from 'vitest';

import { shoppingListQueryKeys } from './queryKeys';

describe('shoppingListQueryKeys', () => {
  it('一覧をユーザーと検索期間ごとに分離する', () => {
    expect(shoppingListQueryKeys.list('user-1', '2026-07-01', '2026-07-07')).toEqual([
      'shoppingList',
      'user-1',
      '2026-07-01',
      '2026-07-07',
    ]);
    expect(shoppingListQueryKeys.list('user-1', '2026-07-01', '2026-07-07')).not.toEqual(
      shoppingListQueryKeys.list('user-1', '2026-07-08', '2026-07-14')
    );
    expect(shoppingListQueryKeys.list('user-1', '2026-07-01', '2026-07-07')).not.toEqual(
      shoppingListQueryKeys.list('user-2', '2026-07-01', '2026-07-07')
    );
  });
});
