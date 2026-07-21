import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useRecipes } from '@/features/recipes';
import { useCreateMenu, useDeleteMenu, useMenus, useUpdateMenu } from '../hooks';
import type { MenuItem } from '../types';
import { MenusPage } from './MenusPage';

vi.mock('@/features/recipes', () => ({ useRecipes: vi.fn() }));
vi.mock('../hooks', () => ({
  useMenus: vi.fn(),
  useCreateMenu: vi.fn(),
  useUpdateMenu: vi.fn(),
  useDeleteMenu: vi.fn(),
}));

const createMutateAsync = vi.fn();
const updateMutateAsync = vi.fn();
const deleteMutateAsync = vi.fn();
const menu: MenuItem = {
  menuId: 'menu-1',
  date: '2026-07-17',
  mealType: 'DINNER',
  recipeId: 'recipe-1',
  servings: 2,
};
const query = (overrides: object = {}) =>
  ({
    data: { from: '2026-07-17', to: '2026-07-23', items: [] },
    isLoading: false,
    error: null,
    ...overrides,
  }) as unknown as ReturnType<typeof useMenus>;
const mutation = (mutateAsync: typeof createMutateAsync, overrides: object = {}) => ({
  mutateAsync,
  isPending: false,
  error: null,
  ...overrides,
});

describe('MenusPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 17, 9, 0, 0));
    vi.mocked(useMenus).mockReturnValue(query());
    vi.mocked(useRecipes).mockReturnValue({
      data: [],
      isLoading: false,
      error: null,
    } as unknown as ReturnType<typeof useRecipes>);
    vi.mocked(useCreateMenu).mockReturnValue(
      mutation(createMutateAsync) as unknown as ReturnType<typeof useCreateMenu>
    );
    vi.mocked(useUpdateMenu).mockReturnValue(
      mutation(updateMutateAsync) as unknown as ReturnType<typeof useUpdateMenu>
    );
    vi.mocked(useDeleteMenu).mockReturnValue(
      mutation(deleteMutateAsync) as unknown as ReturnType<typeof useDeleteMenu>
    );
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it.each([
    [query({ isLoading: true }), '献立を読み込み中...'],
    [query({ error: new Error('取得失敗') }), '献立の取得に失敗しました。'],
    [query(), '対象期間 (2026-07-17 〜 2026-07-23) に献立がありません。'],
  ])('主要状態を表示する', (state, text) => {
    vi.mocked(useMenus).mockReturnValue(state);

    render(<MenusPage />);

    expect(screen.getByText(text)).toBeInTheDocument();
  });

  it('日付と食事区分ごとに献立を表示する', () => {
    const breakfastMenu: MenuItem = {
      menuId: 'menu-breakfast',
      date: '2026-07-17',
      mealType: 'BREAKFAST',
      recipeId: 'recipe-breakfast',
      servings: 1,
    };
    const dinnerMenu: MenuItem = {
      menuId: 'menu-dinner',
      date: '2026-07-17',
      mealType: 'DINNER',
      recipeId: 'recipe-dinner',
      servings: 2,
    };
    const lunchMenu: MenuItem = {
      menuId: 'menu-lunch',
      date: '2026-07-18',
      mealType: 'LUNCH',
      recipeId: 'recipe-lunch',
      servings: 3,
    };
    vi.mocked(useMenus).mockReturnValue(
      query({
        data: {
          from: '2026-07-17',
          to: '2026-07-23',
          items: [breakfastMenu, dinnerMenu, lunchMenu],
        },
      })
    );
    vi.mocked(useRecipes).mockReturnValue({
      data: [
        { recipeId: 'recipe-breakfast', name: 'トースト' },
        { recipeId: 'recipe-dinner', name: 'カレー' },
        { recipeId: 'recipe-lunch', name: 'パスタ' },
      ],
    } as unknown as ReturnType<typeof useRecipes>);

    render(<MenusPage />);

    const july17Section = screen.getByRole('heading', { name: '2026-07-17' }).closest('section')!;
    const july17View = within(july17Section);
    const breakfastBlock = july17View.getByRole('heading', { name: '朝' }).parentElement!;
    const dinnerBlock = july17View.getByRole('heading', { name: '夜' }).parentElement!;

    expect(within(breakfastBlock).getByText('レシピ名: トースト')).toBeInTheDocument();
    expect(within(breakfastBlock).getByLabelText('人数')).toHaveValue(1);
    expect(within(breakfastBlock).queryByText('レシピ名: カレー')).not.toBeInTheDocument();
    expect(within(dinnerBlock).getByText('レシピ名: カレー')).toBeInTheDocument();
    expect(within(dinnerBlock).getByLabelText('人数')).toHaveValue(2);
    expect(within(dinnerBlock).queryByText('レシピ名: トースト')).not.toBeInTheDocument();
    expect(july17View.queryByText('レシピ名: パスタ')).not.toBeInTheDocument();

    const july18Section = screen.getByRole('heading', { name: '2026-07-18' }).closest('section')!;
    const july18View = within(july18Section);
    const lunchBlock = july18View.getByRole('heading', { name: '昼' }).parentElement!;

    expect(within(lunchBlock).getByText('レシピ名: パスタ')).toBeInTheDocument();
    expect(within(lunchBlock).getByLabelText('人数')).toHaveValue(3);
    expect(july18View.queryByText('レシピ名: トースト')).not.toBeInTheDocument();
    expect(july18View.queryByText('レシピ名: カレー')).not.toBeInTheDocument();
  });

  it('未登録recipeIdを代替表示する', () => {
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));

    render(<MenusPage />);

    expect(screen.getByText('レシピ名: 未登録レシピ (recipe-1)')).toBeInTheDocument();
  });

  it('開始日と表示日数を取得期間へ反映する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MenusPage />);

    fireEvent.change(screen.getByLabelText('開始日'), { target: { value: '2026-08-01' } });
    await user.clear(screen.getByLabelText('表示日数'));
    await user.type(screen.getByLabelText('表示日数'), '3');

    expect(useMenus).toHaveBeenLastCalledWith({
      from: '2026-08-01',
      to: '2026-08-03',
      enabled: true,
    });
    expect(screen.getByText('API 取得期間: 2026-08-01 〜 2026-08-03')).toBeInTheDocument();
  });

  it.each([
    ['0', '1', '2026-07-17'],
    ['31', '30', '2026-08-15'],
  ])('表示日数を1日から30日の範囲へ補正する', async (input, normalized, endDate) => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MenusPage />);
    const displayDays = screen.getByLabelText('表示日数');

    await user.clear(displayDays);
    await user.type(displayDays, input);
    await user.tab();

    expect(displayDays).toHaveValue(Number(normalized));
    expect(screen.getByText(`API 取得期間: 2026-07-17 〜 ${endDate}`)).toBeInTheDocument();
  });

  it('追加入力を正規化して登録する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    createMutateAsync.mockResolvedValue({ menuId: 'menu-2' });
    render(<MenusPage />);

    await user.clear(screen.getByLabelText('日付'));
    await user.type(screen.getByLabelText('日付'), '2026-07-20');
    await user.selectOptions(screen.getByLabelText('食事区分'), 'LUNCH');
    await user.type(screen.getByLabelText('レシピ'), '  recipe-2  ');
    await user.clear(screen.getByLabelText('人数'));
    await user.type(screen.getByLabelText('人数'), '3');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(createMutateAsync).toHaveBeenCalledWith({
      date: '2026-07-20',
      mealType: 'LUNCH',
      recipeId: 'recipe-2',
      servings: 3,
    });
    expect(screen.getByLabelText('レシピ')).toHaveValue('');
    expect(screen.getByLabelText('人数')).toHaveValue(1);
  });

  it('recipeIdが空の場合はブラウザーvalidationで登録しない', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MenusPage />);
    const recipeId = screen.getByLabelText('レシピ');

    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(recipeId).toBeInvalid();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('追加の不正な人数はブラウザーvalidationで登録しない', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    render(<MenusPage />);
    const servings = screen.getByLabelText('人数');

    await user.type(screen.getByLabelText('レシピ'), 'recipe-2');
    await user.clear(servings);
    await user.type(servings, '0');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(servings).toBeInvalid();
    expect(createMutateAsync).not.toHaveBeenCalled();
  });

  it('登録失敗時にエラーと入力値を保持する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    createMutateAsync.mockRejectedValue(new Error('登録できません'));
    render(<MenusPage />);

    await user.type(screen.getByLabelText('レシピ'), 'recipe-2');
    await user.clear(screen.getByLabelText('人数'));
    await user.type(screen.getByLabelText('人数'), '3');
    await user.click(screen.getByRole('button', { name: '追加' }));

    expect(await screen.findByText('登録できません')).toBeInTheDocument();
    expect(screen.getByLabelText('レシピ')).toHaveValue('recipe-2');
    expect(screen.getByLabelText('人数')).toHaveValue(3);
  });

  it('登録済み献立を編集して更新する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    updateMutateAsync.mockResolvedValue({ menuId: 'menu-1' });
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);
    const menuItemView = within(screen.getByRole('listitem'));

    await user.clear(menuItemView.getByLabelText('レシピID'));
    await user.type(menuItemView.getByLabelText('レシピID'), ' recipe-2 ');
    const servings = menuItemView.getByLabelText('人数');
    await user.clear(servings);
    await user.type(servings, '4');
    await user.click(menuItemView.getByRole('button', { name: '更新' }));

    expect(updateMutateAsync).toHaveBeenCalledWith({
      date: '2026-07-17',
      mealType: 'DINNER',
      recipeId: 'recipe-2',
      servings: 4,
    });
  });

  it('編集時にrecipeIdが空なら更新しない', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);
    const menuItemView = within(screen.getByRole('listitem'));

    await user.clear(menuItemView.getByLabelText('レシピID'));
    await user.click(menuItemView.getByRole('button', { name: '更新' }));

    expect(menuItemView.getByText('レシピIDを入力してください。')).toBeInTheDocument();
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });

  it('編集時の人数が0なら更新しない', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);
    const menuItemView = within(screen.getByRole('listitem'));
    const servings = menuItemView.getByLabelText('人数');

    await user.clear(servings);
    await user.type(servings, '0');
    await user.click(menuItemView.getByRole('button', { name: '更新' }));

    expect(servings).toBeInvalid();
    expect(menuItemView.getByText('人数は0より大きい値で入力してください。')).toBeInTheDocument();
    expect(updateMutateAsync).not.toHaveBeenCalled();
  });

  it('更新失敗時にエラーと編集中の値を保持する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    updateMutateAsync.mockRejectedValue(new Error('更新できません'));
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);
    const menuItemView = within(screen.getByRole('listitem'));

    await user.clear(menuItemView.getByLabelText('レシピID'));
    await user.type(menuItemView.getByLabelText('レシピID'), 'recipe-2');
    const servings = menuItemView.getByLabelText('人数');
    await user.clear(servings);
    await user.type(servings, '4');
    await user.click(menuItemView.getByRole('button', { name: '更新' }));

    expect(await menuItemView.findByText('更新できません')).toBeInTheDocument();
    expect(menuItemView.getByLabelText('レシピID')).toHaveValue('recipe-2');
    expect(servings).toHaveValue(4);
  });

  it('削除確認をキャンセルした場合は削除しない', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(window.confirm).toHaveBeenCalledWith('この献立を削除しますか？');
    expect(deleteMutateAsync).not.toHaveBeenCalled();
  });

  it('削除確認を承認した場合は対象menuIdを削除する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteMutateAsync.mockResolvedValue(undefined);
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(deleteMutateAsync).toHaveBeenCalledWith('menu-1');
  });

  it('削除失敗時にエラーと対象献立を表示し続ける', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    deleteMutateAsync.mockRejectedValue(new Error('削除できません'));
    vi.mocked(useMenus).mockReturnValue(query({ data: { from: '', to: '', items: [menu] } }));
    render(<MenusPage />);

    await user.click(screen.getByRole('button', { name: '削除' }));

    expect(await screen.findByText('削除できません')).toBeInTheDocument();
    expect(screen.getByText('レシピ名: 未登録レシピ (recipe-1)')).toBeInTheDocument();
  });
});
