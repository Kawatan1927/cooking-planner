import { describe, expect, it } from 'vitest';
import { isNonEmptyString, isPositiveNumber, isUuid, isValidDate } from './validation';

describe('isUuid', () => {
  it.each(['123e4567-e89b-12d3-a456-426614174000', '123E4567-E89B-12D3-A456-426614174000'])(
    '正しいUUIDを受け入れる: %s',
    value => expect(isUuid(value)).toBe(true)
  );

  it.each(['', '123e4567e89b12d3a456426614174000', '123e4567-e89b-12d3-a456-42661417400g'])(
    '不正なUUIDを拒否する: %s',
    value => expect(isUuid(value)).toBe(false)
  );
});

describe('isNonEmptyString', () => {
  it.each(['recipe', ' recipe '])('空でない文字列を受け入れる', value =>
    expect(isNonEmptyString(value)).toBe(true)
  );
  it.each(['', '   ', null, undefined, 1, {}])('空または非文字列を拒否する', value =>
    expect(isNonEmptyString(value)).toBe(false)
  );
});

describe('isPositiveNumber', () => {
  it.each([1, 1.5, Number.MIN_VALUE])('有限の正数を受け入れる', value =>
    expect(isPositiveNumber(value)).toBe(true)
  );
  it.each([0, -1, NaN, Infinity, -Infinity, '1', null])('正数でない値を拒否する', value =>
    expect(isPositiveNumber(value)).toBe(false)
  );
});

describe('isValidDate', () => {
  it.each(['2026-07-13', '2024-02-29', '2026-01-31'])('実在する日付を受け入れる', value =>
    expect(isValidDate(value)).toBe(true)
  );
  it.each([
    '2023-02-29',
    '2026-02-30',
    '2026-13-01',
    '2026-00-10',
    '2026-01-00',
    '2026-1-01',
    'not-a-date',
  ])('不正な日付を拒否する', value => expect(isValidDate(value)).toBe(false));
});
