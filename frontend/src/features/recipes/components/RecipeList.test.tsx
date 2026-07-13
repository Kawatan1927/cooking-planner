import { render, screen } from '@testing-library/react';
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

describe('RecipeList', () => {
  it('空の場合に案内を表示する', () => {
    render(<RecipeList recipes={[]} />);

    expect(screen.getByText('登録されているレシピがありません。')).toBeInTheDocument();
  });

  it('一覧を表示して詳細選択を通知する', async () => {
    const user = userEvent.setup();
    const onRecipeClick = vi.fn();
    render(<RecipeList recipes={[recipe]} onRecipeClick={onRecipeClick} />);

    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('カレー')).toBeInTheDocument();
    expect(screen.getByText('料理本 (p.10)')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '詳細を見る' }));

    expect(onRecipeClick).toHaveBeenCalledOnce();
    expect(onRecipeClick).toHaveBeenCalledWith('recipe-1');
  });
});
