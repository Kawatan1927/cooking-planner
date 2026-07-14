import { useState } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '@/lib/apiClient';
import { useCreateRecipe } from '../hooks';
import { RecipeNewPage } from './RecipeNewPage';

vi.mock('../hooks', () => ({ useCreateRecipe: vi.fn() }));

const mutateAsync = vi.fn();
const mutation = (overrides: object = {}) =>
  ({ mutateAsync, isPending: false, error: null, ...overrides }) as unknown as ReturnType<
    typeof useCreateRecipe
  >;

function useCreateRecipeFailureMock() {
  const [error, setError] = useState<Error | null>(null);

  return mutation({
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

function CreatedRecipeRoute() {
  const { recipeId } = useParams();
  return <p>作成した詳細: {recipeId}</p>;
}

const renderPage = () =>
  render(
    <MemoryRouter initialEntries={['/recipes/new']}>
      <Routes>
        <Route path="/recipes/new" element={<RecipeNewPage />} />
        <Route path="/recipes/:recipeId" element={<CreatedRecipeRoute />} />
      </Routes>
    </MemoryRouter>
  );

describe('RecipeNewPage', () => {
  beforeEach(() => {
    vi.mocked(useCreateRecipe).mockReset();
    mutateAsync.mockReset();
    vi.mocked(useCreateRecipe).mockReturnValue(mutation());
  });

  afterEach(() => {
    cleanup();
  });

  it('必須項目のエラーを表示して送信しない', async () => {
    const user = userEvent.setup();
    renderPage();

    await user.clear(screen.getByLabelText('基本人数 *'));
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(screen.getByText('レシピ名を入力してください。')).toBeInTheDocument();
    expect(screen.getByText('基本人数を入力してください。')).toBeInTheDocument();
    expect(screen.getByText('材料名を入力してください。')).toBeInTheDocument();
    expect(screen.getByText('分量を入力してください。')).toBeInTheDocument();
    expect(screen.getByText('単位を入力してください。')).toBeInTheDocument();
    expect(mutateAsync).not.toHaveBeenCalled();
  });

  it('材料行を追加・削除し最後の1行を残す', async () => {
    const user = userEvent.setup();
    renderPage();

    expect(screen.getAllByLabelText('材料名 *')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'この行を削除' })).toBeDisabled();

    await user.click(screen.getByRole('button', { name: '材料行を追加' }));

    expect(screen.getAllByLabelText('材料名 *')).toHaveLength(2);
    const removeButtons = screen.getAllByRole('button', { name: 'この行を削除' });
    await user.click(removeButtons[1]);

    expect(screen.getAllByLabelText('材料名 *')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'この行を削除' })).toBeDisabled();
  });

  it('正規化したrequestを送信して詳細へ遷移する', async () => {
    const user = userEvent.setup();
    mutateAsync.mockResolvedValue({ recipeId: 'recipe-1' });
    renderPage();

    await user.type(screen.getByLabelText('レシピ名 *'), '  カレー  ');
    await user.type(screen.getByLabelText('出典本'), '  料理本  ');
    await user.type(screen.getByLabelText('出典ページ'), '12');
    await user.type(screen.getByLabelText('メモ'), '   ');
    await user.type(screen.getByLabelText('材料名 *'), '  肉  ');
    await user.type(screen.getByLabelText('分量 *'), '200');
    await user.type(screen.getByLabelText('単位 *'), '  g  ');
    await user.type(screen.getByLabelText('備考'), '   ');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(mutateAsync).toHaveBeenCalledWith({
      name: 'カレー',
      sourceBook: '料理本',
      sourcePage: 12,
      baseServings: 2,
      memo: null,
      ingredients: [
        {
          ingredientName: '肉',
          quantity: 200,
          unit: 'g',
          note: null,
        },
      ],
    });
    expect(await screen.findByText('作成した詳細: recipe-1')).toBeInTheDocument();
  });

  it('有効な入力の送信に失敗した場合はAPIエラーを表示して遷移しない', async () => {
    const user = userEvent.setup();
    mutateAsync.mockRejectedValue(new ApiError(400, 'VALIDATION_ERROR', '登録できません'));
    vi.mocked(useCreateRecipe).mockImplementation(useCreateRecipeFailureMock);
    renderPage();

    await user.type(screen.getByLabelText('レシピ名 *'), 'カレー');
    await user.type(screen.getByLabelText('材料名 *'), '肉');
    await user.type(screen.getByLabelText('分量 *'), '200');
    await user.type(screen.getByLabelText('単位 *'), 'g');
    await user.click(screen.getByRole('button', { name: '保存' }));

    expect(await screen.findByText('保存に失敗しました。登録できません')).toBeInTheDocument();
    expect(mutateAsync).toHaveBeenCalledOnce();
    expect(screen.queryByText('作成した詳細')).not.toBeInTheDocument();
  });
});
