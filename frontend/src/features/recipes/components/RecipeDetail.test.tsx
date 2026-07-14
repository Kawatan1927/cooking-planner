import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecipe } from '../hooks';
import { RecipeDetail } from './RecipeDetail';

vi.mock('../hooks', () => ({ useRecipe: vi.fn() }));

const state = (value: object) => value as ReturnType<typeof useRecipe>;

describe('RecipeDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
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

  it('任意のレシピ情報と材料備考を表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(
      state({
        isLoading: false,
        error: null,
        data: {
          recipeId: 'recipe-1',
          name: 'カレー',
          sourceBook: '料理本',
          sourcePage: 10,
          baseServings: 2,
          memo: '辛口',
          ingredients: [{ ingredientName: '肉', quantity: 200, unit: 'g', note: '一口大' }],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      })
    );

    render(<RecipeDetail recipeId="recipe-1" />);

    expect(screen.getByText('出典: 料理本')).toBeInTheDocument();
    expect(screen.getByText('ページ: 10')).toBeInTheDocument();
    expect(screen.getByText('辛口')).toBeInTheDocument();
    expect(
      screen.getByText(
        (_, element) => element?.tagName === 'LI' && element.textContent === '肉: 200 g (一口大)'
      )
    ).toBeInTheDocument();
  });

  it('材料が空の場合に案内を表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(
      state({
        isLoading: false,
        error: null,
        data: {
          recipeId: 'recipe-1',
          name: 'カレー',
          baseServings: 2,
          ingredients: [],
          createdAt: '2026-01-01T00:00:00Z',
          updatedAt: '2026-01-02T00:00:00Z',
        },
      })
    );

    render(<RecipeDetail recipeId="recipe-1" />);

    expect(screen.getByText('材料が登録されていません')).toBeInTheDocument();
  });
});
