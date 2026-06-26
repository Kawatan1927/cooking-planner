import { describe, expect, it } from 'vitest';
import { mergeQuantity, splitQuantity } from './quantity';

describe('splitQuantity', () => {
  it('数値は quantityValue に文字列化して入れる', () => {
    expect(splitQuantity(300)).toEqual({ quantityValue: '300', quantityText: null });
  });

  it('小数も文字列化して保持する', () => {
    expect(splitQuantity(1.5)).toEqual({ quantityValue: '1.5', quantityText: null });
  });

  it('文字列は quantityText に入れる', () => {
    expect(splitQuantity('少々')).toEqual({ quantityValue: null, quantityText: '少々' });
  });
});

describe('mergeQuantity', () => {
  it('quantityValue があれば数値に変換して返す', () => {
    expect(mergeQuantity('300', null)).toBe(300);
  });

  it('小数の quantityValue も数値で返す', () => {
    expect(mergeQuantity('1.5', null)).toBe(1.5);
  });

  it('quantityValue が null なら quantityText を返す', () => {
    expect(mergeQuantity(null, '少々')).toBe('少々');
  });
});
