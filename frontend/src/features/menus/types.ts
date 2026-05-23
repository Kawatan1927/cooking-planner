export type MealType = 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'OTHER';

export interface MenuItem {
  date: string;
  mealType: MealType;
  menuId: string;
  recipeId: string;
  servings: number;
}

export interface MenusResponse {
  from: string;
  to: string;
  items: MenuItem[];
}

export interface MenuInput {
  date: string;
  mealType: MealType;
  recipeId: string;
  servings: number;
  memo?: string | null;
}

export interface CreateMenuResponse {
  menuId: string;
}

export interface UpdateMenuResponse {
  menuId: string;
}
