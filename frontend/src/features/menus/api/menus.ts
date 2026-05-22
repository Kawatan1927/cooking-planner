import { apiFetch } from '@/lib/apiClient';
import type { CreateMenuResponse, MenuInput, MenusResponse, UpdateMenuResponse } from '../types';

export interface GetMenusParams {
  from?: string;
  to?: string;
}

const buildQueryString = (params: GetMenusParams): string => {
  const searchParams = new URLSearchParams();
  if (params.from) {
    searchParams.set('from', params.from);
  }
  if (params.to) {
    searchParams.set('to', params.to);
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
};

export async function getMenus(token: string, params: GetMenusParams = {}): Promise<MenusResponse> {
  return apiFetch<MenusResponse>(`/menus${buildQueryString(params)}`, {
    method: 'GET',
    token,
  });
}

export async function createMenu(data: MenuInput, token: string): Promise<CreateMenuResponse> {
  return apiFetch<CreateMenuResponse>('/menus', {
    method: 'POST',
    token,
    body: data,
  });
}

export async function updateMenu(
  menuId: string,
  data: MenuInput,
  token: string
): Promise<UpdateMenuResponse> {
  return apiFetch<UpdateMenuResponse>(`/menus/${menuId}`, {
    method: 'PUT',
    token,
    body: data,
  });
}

export async function deleteMenu(menuId: string, token: string): Promise<void> {
  await apiFetch<null>(`/menus/${menuId}`, {
    method: 'DELETE',
    token,
  });
}
