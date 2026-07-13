import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiFetch } from '@/lib/apiClient';
import { createRecipe, getRecipe, getRecipes, updateRecipe } from './recipes';
import type { CreateRecipeRequest, Recipe, RecipeDetail } from '../types';

vi.mock('@/lib/apiClient', () => ({ apiFetch: vi.fn() }));

const input: CreateRecipeRequest = {
  name: '鶏の照り焼き',
  sourceBook: '毎日の料理',
  sourcePage: 12,
  baseServings: 2,
  memo: null,
  ingredients: [{ ingredientName: '鶏肉', quantity: 300, unit: 'g', note: null }],
};

describe('recipes API', () => {
  beforeEach(() => vi.clearAllMocks());

  it('一覧をGET /recipesから取得する', async () => {
    const recipes: Recipe[] = [];
    vi.mocked(apiFetch).mockResolvedValue(recipes);
    await expect(getRecipes()).resolves.toBe(recipes);
    expect(apiFetch).toHaveBeenCalledWith('/recipes', { method: 'GET' });
  });

  it('詳細をGET /recipes/{recipeId}から取得する', async () => {
    const detail: RecipeDetail = {
      recipeId: 'recipe-1',
      name: '鶏の照り焼き',
      baseServings: 2,
      createdAt: '2026-07-13T00:00:00.000Z',
      updatedAt: '2026-07-13T00:00:00.000Z',
      ingredients: [],
    };
    vi.mocked(apiFetch).mockResolvedValue(detail);
    await expect(getRecipe('recipe-1')).resolves.toBe(detail);
    expect(apiFetch).toHaveBeenCalledWith('/recipes/recipe-1', {
      method: 'GET',
    });
  });

  it('POST /recipesへ登録内容を渡す', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ recipeId: 'recipe-1' });
    await expect(createRecipe(input)).resolves.toEqual({
      recipeId: 'recipe-1',
    });
    expect(apiFetch).toHaveBeenCalledWith('/recipes', {
      method: 'POST',
      body: input,
    });
  });

  it('PUT /recipes/{recipeId}へ更新内容を渡す', async () => {
    vi.mocked(apiFetch).mockResolvedValue({ recipeId: 'recipe-1' });
    await expect(updateRecipe('recipe-1', input)).resolves.toEqual({
      recipeId: 'recipe-1',
    });
    expect(apiFetch).toHaveBeenCalledWith('/recipes/recipe-1', {
      method: 'PUT',
      body: input,
    });
  });
});
