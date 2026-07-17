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
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-07-17T09:00:00+09:00'));
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
    vi.mocked(useMenus).mockReturnValue(
      query({ data: { from: '2026-07-17', to: '2026-07-23', items: [menu] } })
    );
    vi.mocked(useRecipes).mockReturnValue({
      data: [{ recipeId: 'recipe-1', name: 'カレー' }],
    } as unknown as ReturnType<typeof useRecipes>);

    render(<MenusPage />);

    const dateHeading = screen.getByRole('heading', { name: '2026-07-17' });
    expect(dateHeading).toBeInTheDocument();
    expect(
      within(dateHeading.parentElement!).getByRole('heading', { name: '夜' })
    ).toBeInTheDocument();
    expect(screen.getByText('レシピ名: カレー')).toBeInTheDocument();
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
});
