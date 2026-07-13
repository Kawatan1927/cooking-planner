import { describe, expect, it } from 'vitest';

import { recipesQueryKeys } from './queryKeys';

describe('recipesQueryKeys', () => {
  it('一覧をユーザーごとに分離する', () => {
    expect(recipesQueryKeys.list('user-1')).toEqual(['recipes', 'user-1']);
    expect(recipesQueryKeys.list('user-1')).not.toEqual(recipesQueryKeys.list('user-2'));
  });

  it('詳細をユーザーとレシピIDごとに分離する', () => {
    expect(recipesQueryKeys.detail('user-1', 'recipe-1')).toEqual([
      'recipes',
      'user-1',
      'recipe-1',
    ]);
    expect(recipesQueryKeys.detail('user-1', 'recipe-1')).not.toEqual(
      recipesQueryKeys.detail('user-1', 'recipe-2')
    );
    expect(recipesQueryKeys.detail('user-1', 'recipe-1')).not.toEqual(
      recipesQueryKeys.detail('user-2', 'recipe-1')
    );
  });
});
