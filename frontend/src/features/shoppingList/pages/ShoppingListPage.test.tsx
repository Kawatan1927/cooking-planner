import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ShoppingListItem } from '../types';
import { useShoppingList } from '../hooks';
import { ShoppingListPage } from './ShoppingListPage';

vi.mock('../hooks', () => ({ useShoppingList: vi.fn() }));

const onion: ShoppingListItem = {
  ingredientName: '玉ねぎ',
  totalQuantity: 1.5,
  unit: '個',
};
const salt: ShoppingListItem = {
  ingredientName: '塩',
  totalQuantity: '少々',
  unit: '',
};
const milk: ShoppingListItem = {
  ingredientName: '牛乳',
  totalQuantity: 300,
  unit: 'ml',
};

const query = (overrides: object = {}) =>
  ({
    data: undefined,
    isLoading: false,
    isFetching: false,
    error: null,
    ...overrides,
  }) as unknown as ReturnType<typeof useShoppingList>;

const renderPage = (initialEntry = '/shopping-list') =>
  render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <ShoppingListPage />
    </MemoryRouter>
  );

describe('ShoppingListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date(2026, 6, 21, 9, 0, 0));
    vi.mocked(useShoppingList).mockReturnValue(query());
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('有効な期間が未指定の場合は取得せず期間指定を案内する', () => {
    renderPage();

    expect(useShoppingList).toHaveBeenLastCalledWith({
      from: undefined,
      to: undefined,
      enabled: false,
    });
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-07-21');
    expect(screen.getByLabelText('終了日')).toHaveValue('2026-07-21');
    expect(screen.getByText('期間を指定して買い物リストを生成してください。')).toBeInTheDocument();
  });

  it.each([
    [query({ isLoading: true }), ['買い物リストを読み込み中です...', '2026-07-21 〜 2026-07-23']],
    [
      query({ error: new Error('取得できません') }),
      ['買い物リストの取得に失敗しました。', '取得できません'],
    ],
    [
      query({ data: { from: '2026-07-21', to: '2026-07-23', items: [] } }),
      ['対象期間の買い物項目はありません。', '2026-07-21 〜 2026-07-23'],
    ],
  ])('loading、error、emptyを表示する', (queryState, expectedTexts) => {
    vi.mocked(useShoppingList).mockReturnValue(queryState);

    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    for (const text of expectedTexts) {
      expect(screen.getByText(text, { exact: false })).toBeInTheDocument();
    }
  });

  it('URLの期間と材料一覧を表示する', () => {
    vi.mocked(useShoppingList).mockReturnValue(
      query({
        data: {
          from: '2026-07-21',
          to: '2026-07-23',
          items: [onion, salt],
        },
      })
    );

    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    expect(useShoppingList).toHaveBeenLastCalledWith({
      from: '2026-07-21',
      to: '2026-07-23',
      enabled: true,
    });
    expect(screen.getByLabelText('開始日')).toHaveValue('2026-07-21');
    expect(screen.getByLabelText('終了日')).toHaveValue('2026-07-23');
    expect(screen.getByText('表示期間')).toBeInTheDocument();
    expect(screen.getByText('2026-07-21 〜 2026-07-23')).toBeInTheDocument();
    expect(screen.getByText('玉ねぎ')).toBeInTheDocument();
    expect(screen.getByText('1.5個')).toBeInTheDocument();
    expect(screen.getByText('塩')).toBeInTheDocument();
    expect(screen.getByText('少々')).toBeInTheDocument();
  });

  it('入力した期間を検索条件へ反映する', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    fireEvent.change(screen.getByLabelText('開始日'), {
      target: { value: '2026-07-24' },
    });
    fireEvent.change(screen.getByLabelText('終了日'), {
      target: { value: '2026-07-26' },
    });
    await user.click(screen.getByRole('button', { name: 'リストを生成' }));

    expect(useShoppingList).toHaveBeenLastCalledWith({
      from: '2026-07-24',
      to: '2026-07-26',
      enabled: true,
    });
  });

  it.each([
    ['', '2026-07-23', '開始日と終了日を入力してください。'],
    ['2026-07-24', '2026-07-23', '終了日は開始日以降の日付を指定してください。'],
  ])('不正な期間は検索条件へ反映しない', (from, to, errorMessage) => {
    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');

    fireEvent.change(screen.getByLabelText('開始日'), { target: { value: from } });
    fireEvent.change(screen.getByLabelText('終了日'), { target: { value: to } });
    fireEvent.submit(screen.getByRole('button', { name: 'リストを生成' }).closest('form')!);

    expect(screen.getByRole('alert')).toHaveTextContent(errorMessage);
    expect(useShoppingList).not.toHaveBeenCalledWith({ from, to, enabled: true });
  });

  it('対象項目だけをチェックし期間変更後に状態をリセットする', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    vi.mocked(useShoppingList).mockImplementation(({ from }) =>
      query({
        data: {
          from: from ?? '',
          to: from === '2026-07-24' ? '2026-07-26' : '2026-07-23',
          items: from === '2026-07-24' ? [onion, milk] : [onion, salt],
        },
      })
    );
    renderPage('/shopping-list?from=2026-07-21&to=2026-07-23');
    const onionCheckbox = screen.getByRole('checkbox', { name: /玉ねぎ/ });
    const saltCheckbox = screen.getByRole('checkbox', { name: /塩/ });

    await user.click(onionCheckbox);

    expect(onionCheckbox).toBeChecked();
    expect(saltCheckbox).not.toBeChecked();
    expect(screen.getByText('1 / 2 件チェック済み')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('開始日'), {
      target: { value: '2026-07-24' },
    });
    fireEvent.change(screen.getByLabelText('終了日'), {
      target: { value: '2026-07-26' },
    });
    await user.click(screen.getByRole('button', { name: 'リストを生成' }));

    expect(screen.getByText('牛乳')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /玉ねぎ/ })).not.toBeChecked();
    expect(screen.getByText('0 / 2 件チェック済み')).toBeInTheDocument();
  });
});
