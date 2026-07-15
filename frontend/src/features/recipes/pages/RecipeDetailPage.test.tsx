import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useCreateMenu } from '@/features/menus';
import { ApiError } from '@/lib/apiClient';
import { useRecipe, useUpdateRecipe } from '../hooks';
import { RecipeDetailPage } from './RecipeDetailPage';

vi.mock('../hooks', () => ({ useRecipe: vi.fn(), useUpdateRecipe: vi.fn() }));
vi.mock('@/features/menus', () => ({ useCreateMenu: vi.fn() }));

const recipe = {
  recipeId: 'recipe-1',
  name: 'カレー',
  sourceBook: '料理本',
  sourcePage: 10,
  baseServings: 2,
  memo: '辛口',
  ingredients: [{ ingredientName: '肉', quantity: 200, unit: 'g', note: null }],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-02T00:00:00Z',
};

const refetch = vi.fn();
const mutateAsync = vi.fn();
const createMenuAsync = vi.fn();

const queryState = (overrides: object = {}) =>
  ({
    data: recipe,
    isLoading: false,
    error: null,
    refetch,
    ...overrides,
  }) as unknown as ReturnType<typeof useRecipe>;

const updateState = (overrides: object = {}) =>
  ({ mutateAsync, isPending: false, error: null, ...overrides }) as unknown as ReturnType<
    typeof useUpdateRecipe
  >;

function useUpdateRecipeFailureMock() {
  const [error, setError] = useState<Error | null>(null);

  return updateState({
    error,
    mutateAsync: async (input: Parameters<typeof mutateAsync>[0]) => {
      try {
        return await mutateAsync(input);
      } catch (mutationError) {
        setError(mutationError as Error);
        throw mutationError;
      }
    },
  });
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/recipes/recipe-1']}>
      <Routes>
        <Route path="/recipes/:id" element={<RecipeDetailPage />} />
      </Routes>
    </MemoryRouter>
  );

describe('RecipeDetailPage', () => {
  beforeEach(() => {
    vi.mocked(useRecipe).mockReset();
    vi.mocked(useUpdateRecipe).mockReset();
    vi.mocked(useCreateMenu).mockReset();
    refetch.mockReset();
    mutateAsync.mockReset();
    createMenuAsync.mockReset();

    vi.mocked(useRecipe).mockReturnValue(queryState());
    vi.mocked(useUpdateRecipe).mockReturnValue(updateState());
    vi.mocked(useCreateMenu).mockReturnValue({
      mutateAsync: createMenuAsync,
      isPending: false,
      error: null,
    } as unknown as ReturnType<typeof useCreateMenu>);
  });

  afterEach(() => {
    cleanup();
  });

  it('loadingを表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(queryState({ data: undefined, isLoading: true }));

    renderPage();

    expect(screen.getByText('レシピを読み込み中です...')).toBeInTheDocument();
  });

  it('取得エラーを表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(
      queryState({ data: undefined, error: new Error('取得失敗') })
    );

    renderPage();

    expect(
      screen.getByRole('heading', { name: 'レシピを読み込めませんでした' })
    ).toBeInTheDocument();
  });

  it('404をnot-foundとして表示する', () => {
    vi.mocked(useRecipe).mockReturnValue(
      queryState({
        data: undefined,
        error: new ApiError(404, 'RECIPE_NOT_FOUND', 'なし'),
      })
    );

    renderPage();

    expect(screen.getByRole('heading', { name: 'レシピが見つかりません' })).toBeInTheDocument();
  });

  it('取得したレシピをフォームの初期値に反映する', () => {
    renderPage();

    expect(screen.getByLabelText('レシピ名 *')).toHaveValue('カレー');
    expect(screen.getByLabelText('出典本')).toHaveValue('料理本');
    expect(screen.getByLabelText('出典ページ')).toHaveValue(10);
    expect(screen.getByLabelText('基本人数 *')).toHaveValue(2);
    expect(screen.getByLabelText('メモ')).toHaveValue('辛口');
    expect(screen.getByLabelText('材料名 *')).toHaveValue('肉');
    expect(screen.getByLabelText('分量 *')).toHaveValue('200');
    expect(screen.getByLabelText('単位 *')).toHaveValue('g');
    expect(screen.getByLabelText('備考')).toHaveValue('');
  });

  it('材料を編集して正規化したrequestを保存する', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ recipeId: 'recipe-1' });
    renderPage();

    const nameInput = screen.getByLabelText('レシピ名 *');
    await user.clear(nameInput);
    await user.type(nameInput, '  シチュー  ');
    await user.click(screen.getByRole('button', { name: '材料行を追加' }));

    const ingredientNames = screen.getAllByLabelText('材料名 *');
    const quantities = screen.getAllByLabelText('分量 *');
    const units = screen.getAllByLabelText('単位 *');
    const notes = screen.getAllByLabelText('備考');
    await user.type(ingredientNames[1], '  玉ねぎ  ');
    await user.type(quantities[1], '0.5');
    await user.type(units[1], '  個  ');
    await user.type(notes[1], '   ');
    await user.click(screen.getAllByRole('button', { name: 'この行を削除' })[0]);
    await user.click(screen.getByRole('button', { name: '編集して保存' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'シチュー',
      sourceBook: '料理本',
      sourcePage: 10,
      baseServings: 2,
      memo: '辛口',
      ingredients: [
        {
          ingredientName: '玉ねぎ',
          quantity: 0.5,
          unit: '個',
          note: null,
        },
      ],
    });
    expect(await screen.findByText('レシピを保存しました。')).toBeInTheDocument();
  });

  it('必須項目のvalidationエラーでは更新しない', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(screen.getByLabelText('レシピ名 *'));
    await user.clear(screen.getByLabelText('材料名 *'));
    await user.clear(screen.getByLabelText('分量 *'));
    await user.clear(screen.getByLabelText('単位 *'));
    await user.click(screen.getByRole('button', { name: '編集して保存' }));

    expect(screen.getByText('レシピ名を入力してください。')).toBeInTheDocument();
    expect(screen.getByText('材料名を入力してください。')).toBeInTheDocument();
    expect(screen.getByText('分量を入力してください。')).toBeInTheDocument();
    expect(screen.getByText('単位を入力してください。')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('有効な入力の更新に失敗した場合はAPIエラーを表示する', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', '更新できません'));
    vi.mocked(useUpdateRecipe).mockImplementation(useUpdateRecipeFailureMock);
    renderPage();

    await user.click(screen.getByRole('button', { name: '編集して保存' }));

    expect(await screen.findByText('保存に失敗しました。更新できません')).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(screen.queryByText('レシピを保存しました。')).not.toBeInTheDocument();
  });
});
