import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Recipe } from '../types';
import { RecipeList } from './RecipeList';

const recipe: Recipe = {
  recipeId: 'recipe-1',
  name: 'カレー',
  sourceBook: '料理本',
  sourcePage: 10,
  baseServings: 2,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const secondRecipe: Recipe = {
  recipeId: 'recipe-2',
  name: 'シチュー',
  baseServings: 4,
  createdAt: '2026-01-03T00:00:00Z',
  updatedAt: '2026-01-04T00:00:00Z',
};

describe('RecipeList', () => {
  it('空の場合に案内を表示する', () => {
    render(<RecipeList recipes={[]} />);

    expect(screen.getByText('登録されているレシピがありません。')).toBeInTheDocument();
  });

  it('一覧を表示して詳細選択を通知する', async () => {
    const user = userEvent.setup();
    const onRecipeClick = vi.fn();
    render(<RecipeList recipes={[recipe, secondRecipe]} onRecipeClick={onRecipeClick} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('カレー')).toBeInTheDocument();
    expect(screen.getByText('料理本 (p.10)')).toBeInTheDocument();

    const firstRow = screen.getByRole('cell', { name: 'カレー' }).closest('tr');
    expect(firstRow).not.toBeNull();
    expect(within(firstRow!).getByRole('cell', { name: '2人分' })).toBeInTheDocument();

    const secondRow = screen.getByRole('cell', { name: 'シチュー' }).closest('tr');
    expect(secondRow).not.toBeNull();
    expect(within(secondRow!).getByRole('cell', { name: '4人分' })).toBeInTheDocument();
    await user.click(within(secondRow!).getByRole('button', { name: '詳細を見る' }));

    expect(onRecipeClick).toHaveBeenCalledOnce();
    expect(onRecipeClick).toHaveBeenCalledWith('recipe-2');
  });
});
