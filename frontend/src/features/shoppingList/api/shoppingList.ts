import { apiFetch } from '@/lib/apiClient';
import type { ShoppingListResponse } from '../types';

export interface GetShoppingListParams {
  from: string;
  to: string;
}

export async function getShoppingList(
  params: GetShoppingListParams
): Promise<ShoppingListResponse> {
  const searchParams = new URLSearchParams({
    from: params.from,
    to: params.to,
  });

  return apiFetch<ShoppingListResponse>(`/shopping-list?${searchParams.toString()}`, {
    method: 'GET',
  });
}
