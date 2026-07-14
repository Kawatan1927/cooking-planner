import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecipes } from '../hooks';
import { RecipeListPage } from './RecipeListPage';

vi.mock('../hooks', () => ({ useRecipes: vi.fn() }));

const state = (value: object) => value as ReturnType<typeof useRecipes>;

function RecipeDetailRoute() {
  const { recipeId } = useParams();
  return <h2>詳細画面 {recipeId}</h2>;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/recipes']}>
      <Routes>
        <Route path="/recipes" element={<RecipeListPage />} />
        <Route path="/recipes/new" element={<h2>登録画面</h2>} />
        <Route path="/recipes/:recipeId" element={<RecipeDetailRoute />} />
      </Routes>
    </MemoryRouter>
  );

const recipe = {
  recipeId: 'recipe-1',
  name: 'カレー',
  baseServings: 2,
  createdAt: '',
  updatedAt: '',
};

const secondRecipe = {
  recipeId: 'recipe-2',
  name: 'シチュー',
  baseServings: 4,
  createdAt: '',
  updatedAt: '',
};

describe('RecipeListPage', () => {
  beforeEach(() => {
    vi.mocked(useRecipes).mockReset();
  });

  afterEach(() => {
    cleanup();
  });

  it.each([
    [state({ isLoading: true }), '読み込み中...'],
    [
      state({ isLoading: false, error: new Error('取得失敗') }),
      'レシピの読み込みに失敗しました。 (取得失敗)',
    ],
    [state({ isLoading: false, error: null, data: [] }), '登録されているレシピがありません。'],
  ])('主要状態を表示する', (queryState, text) => {
    vi.mocked(useRecipes).mockReturnValue(queryState);

    renderPage();

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('一覧を表示して新規登録へ遷移する', async () => {
    const user = userEvent.setup();
    vi.mocked(useRecipes).mockReturnValue(state({ isLoading: false, error: null, data: [recipe] }));

    renderPage();

    expect(screen.getByRole('cell', { name: 'カレー' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: '新規レシピを追加' }));

    expect(screen.getByRole('heading', { name: '登録画面' })).toBeInTheDocument();
  });

  it('詳細へ遷移する', async () => {
    const user = userEvent.setup();
    vi.mocked(useRecipes).mockReturnValue(
      state({ isLoading: false, error: null, data: [recipe, secondRecipe] })
    );

    renderPage();

    await user.click(screen.getAllByRole('button', { name: '詳細を見る' })[1]);

    expect(screen.getByRole('heading', { name: '詳細画面 recipe-2' })).toBeInTheDocument();
  });
});
