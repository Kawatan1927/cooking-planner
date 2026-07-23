import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/apiClient';
import type { ShoppingListResponse } from '../types';
import { getShoppingList } from './shoppingList';

vi.mock('@/lib/apiClient', () => ({ apiFetch: vi.fn() }));

const response: ShoppingListResponse = {
  from: '2026-07-21',
  to: '2026-07-23',
  items: [
    {
      ingredientName: '玉ねぎ',
      totalQuantity: 1.5,
      unit: '個',
    },
  ],
};

describe('shoppingList API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fromとtoをGET /shopping-listのquery parameterへ反映する', async () => {
    vi.mocked(apiFetch).mockResolvedValue(response);

    await expect(getShoppingList({ from: '2026-07-21', to: '2026-07-23' })).resolves.toBe(response);
    expect(apiFetch).toHaveBeenCalledWith('/shopping-list?from=2026-07-21&to=2026-07-23', {
      method: 'GET',
    });
  });
});
