export interface ShoppingListItem {
  ingredientName: string;
  totalQuantity: number | string;
  unit: string;
}

export interface ShoppingListResponse {
  from: string;
  to: string;
  items: ShoppingListItem[];
}
