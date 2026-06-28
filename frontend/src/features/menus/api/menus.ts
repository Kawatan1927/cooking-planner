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

export async function getMenus(params: GetMenusParams = {}): Promise<MenusResponse> {
  return apiFetch<MenusResponse>(`/menus${buildQueryString(params)}`, {
    method: 'GET',
  });
}

export async function createMenu(data: MenuInput): Promise<CreateMenuResponse> {
  return apiFetch<CreateMenuResponse>('/menus', {
    method: 'POST',
    body: data,
  });
}

export async function updateMenu(menuId: string, data: MenuInput): Promise<UpdateMenuResponse> {
  return apiFetch<UpdateMenuResponse>(`/menus/${menuId}`, {
    method: 'PUT',
    body: data,
  });
}

export async function deleteMenu(menuId: string): Promise<void> {
  await apiFetch<null>(`/menus/${menuId}`, {
    method: 'DELETE',
  });
}
