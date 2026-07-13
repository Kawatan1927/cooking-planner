import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecipe } from '../hooks';
import { RecipeDetail } from './RecipeDetail';

vi.mock('../hooks', () => ({ useRecipe: vi.fn() }));

const state = (value: object) => value as ReturnType<typeof useRecipe>;

describe('RecipeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('読み込み中の状態を表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(state({ isLoading: true }));

    render(<RecipeDetail recipeId="recipe-1" />);

    expect(screen.getByText('読み込み中...')).toBeInTheDocument();
  });

  it('取得エラーを表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(state({ isLoading: false, error: new Error('取得失敗') }));

    render(<RecipeDetail recipeId="recipe-1" />);

    expect(screen.getByText('取得失敗')).toBeInTheDocument();
  });

  it('レシピが存在しない場合に案内を表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(state({ isLoading: false, error: null, data: undefined }));

    render(<RecipeDetail recipeId="recipe-1" />);

    expect(screen.getByText('レシピが見つかりません')).toBeInTheDocument();
  });

  it('基本情報と材料を表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(
      state({
        isLoading: false,
        error: null,
        data: {
          recipeId: 'recipe-1',
          name: 'カレー',
          baseServings: 2,
          ingredients: [{ ingredientName: '肉', quantity: 200, unit: 'g', note: '一口大' }],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      })
    );

    render(<RecipeDetail recipeId="recipe-1" />);

    expect(screen.getByRole('heading', { name: 'カレー' })).toBeInTheDocument();
    expect(screen.getByText(/肉: 200 g/)).toBeInTheDocument();
  });
});
