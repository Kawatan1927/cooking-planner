import { screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { getRecipes } from '../api/recipes';
import { renderWithProviders } from '../../../test/renderWithProviders';
import { RecipeListPage } from './RecipeListPage';

vi.mock('../api/recipes', () => ({ getRecipes: vi.fn() }));

const mockedGetRecipes = vi.mocked(getRecipes);

describe('RecipeListPage', () => {
  it('取得したレシピ名を表示する', async () => {
    mockedGetRecipes.mockResolvedValue([
      {
        recipeId: 'recipe-1',
        name: '鶏の照り焼き',
        sourceBook: null,
        sourcePage: null,
        baseServings: 2,
        createdAt: '2026-07-10T00:00:00.000Z',
        updatedAt: '2026-07-10T00:00:00.000Z',
      },
    ]);

    renderWithProviders(<RecipeListPage />);

    expect(await screen.findByText('鶏の照り焼き')).toBeInTheDocument();
    expect(mockedGetRecipes).toHaveBeenCalledTimes(1);
  });
});
