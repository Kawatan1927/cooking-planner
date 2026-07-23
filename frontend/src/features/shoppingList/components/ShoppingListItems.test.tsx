import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ShoppingListItem } from '../types';
import { ShoppingListItems } from './ShoppingListItems';

const items: ShoppingListItem[] = [
  { ingredientName: '玉ねぎ', totalQuantity: 1.5, unit: '個' },
  { ingredientName: '塩', totalQuantity: '少々', unit: '' },
  { ingredientName: '醤油', totalQuantity: '1 + 少々', unit: 'ml' },
];

describe('ShoppingListItems', () => {
  it('空のリストとチェック件数を表示する', () => {
    render(<ShoppingListItems items={[]} checkedItems={{}} onToggleItem={vi.fn()} />);

    expect(screen.getByText('0 / 0 件チェック済み')).toBeInTheDocument();
    expect(screen.getByRole('list')).toBeEmptyDOMElement();
  });

  it('材料名、数値・文字列数量、単位、チェック状態を表示する', () => {
    render(
      <ShoppingListItems
        items={items}
        checkedItems={{ '["玉ねぎ","個"]': true }}
        onToggleItem={vi.fn()}
      />
    );

    expect(screen.getByText('玉ねぎ')).toBeInTheDocument();
    expect(screen.getByText('1.5個')).toBeInTheDocument();
    expect(screen.getByText('塩')).toBeInTheDocument();
    expect(screen.getByText('少々')).toBeInTheDocument();
    expect(screen.getByText('醤油')).toBeInTheDocument();
    expect(screen.getByText('1 + 少々ml')).toBeInTheDocument();
    expect(screen.getByText('1 / 3 件チェック済み')).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: /玉ねぎ/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /塩/ })).not.toBeChecked();
  });

  it('操作した材料名と単位の組み合わせだけを通知する', async () => {
    const user = userEvent.setup();
    const onToggleItem = vi.fn();
    const sameNameItems: ShoppingListItem[] = [
      { ingredientName: 'だし', totalQuantity: 1, unit: '袋' },
      { ingredientName: 'だし', totalQuantity: 2, unit: 'g' },
    ];
    render(
      <ShoppingListItems items={sameNameItems} checkedItems={{}} onToggleItem={onToggleItem} />
    );

    await user.click(screen.getAllByRole('checkbox', { name: /だし/ })[1]);

    expect(onToggleItem).toHaveBeenCalledOnce();
    expect(onToggleItem).toHaveBeenCalledWith('["だし","g"]');
  });
});
