import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { createRecipeWithIngredients } from './repository';

const { createRecipeWithIngredientsMock } = vi.hoisted(() => ({
  createRecipeWithIngredientsMock: vi.fn<typeof createRecipeWithIngredients>(),
}));

vi.mock('./repository', () => ({
  listRecipesByUser: vi.fn(),
  findRecipeWithIngredients: vi.fn(),
  createRecipeWithIngredients: createRecipeWithIngredientsMock,
  replaceRecipeWithIngredients: vi.fn(),
}));

vi.mock('../shared/auth', () => ({
  authMiddleware: () => async (_c: unknown, next: () => Promise<void>) => next(),
  getUserId: () => 'user-123',
}));

import app from '../app';

const validBody = {
  name: '親子丼',
  baseServings: 2,
  ingredients: [
    {
      ingredientName: '鶏もも肉',
      quantity: 300,
      unit: 'g',
    },
    {
      ingredientName: '塩',
      quantity: '少々',
      unit: '適量',
      note: '仕上げ用',
    },
  ],
};

const postRecipe = (body: unknown) =>
  app.request('/api/recipes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('POST /api/recipes', () => {
  beforeEach(() => {
    createRecipeWithIngredientsMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('変換済み入力をrepositoryへ渡して201を返す', async () => {
    createRecipeWithIngredientsMock.mockResolvedValue('11111111-1111-1111-1111-111111111111');

    const response = await postRecipe(validBody);

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({
      recipeId: '11111111-1111-1111-1111-111111111111',
    });
    expect(createRecipeWithIngredientsMock).toHaveBeenCalledWith(
      {
        userId: 'user-123',
        name: '親子丼',
        sourceBook: null,
        sourcePage: null,
        baseServings: 2,
        memo: null,
      },
      [
        {
          ingredientName: '鶏もも肉',
          quantity: 300,
          unit: 'g',
          note: null,
        },
        {
          ingredientName: '塩',
          quantity: '少々',
          unit: '適量',
          note: '仕上げ用',
        },
      ]
    );
  });

  it('JSONとして解析できないbodyは400を返す', async () => {
    const response = await app.request('/api/recipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Invalid JSON in request body',
        details: null,
      },
    });
    expect(createRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it.each([
    { caseName: 'null', body: null },
    { caseName: '配列', body: [] },
    { caseName: '文字列', body: 'recipe' },
    { caseName: '数値', body: 1 },
    { caseName: '真偽値', body: true },
  ])('トップレベルbodyが$caseNameの場合は400を返す', async ({ body }) => {
    const response = await postRecipe(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: {
        code: 'BAD_REQUEST',
        message: 'Request body must be an object',
        details: null,
      },
    });
    expect(createRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it.each([
    {
      caseName: 'nameが空',
      body: { ...validBody, name: ' ' },
      message: 'Recipe name is required',
    },
    {
      caseName: 'nameが文字列ではない',
      body: { ...validBody, name: 123 },
      message: 'Recipe name is required',
    },
    {
      caseName: 'baseServingsが0',
      body: { ...validBody, baseServings: 0 },
      message: 'baseServings must be a positive number',
    },
    {
      caseName: 'baseServingsが数値ではない',
      body: { ...validBody, baseServings: '2' },
      message: 'baseServings must be a positive number',
    },
    {
      caseName: 'sourceBookが文字列またはnullではない',
      body: { ...validBody, sourceBook: 123 },
      message: 'sourceBook must be a string or null',
    },
    {
      caseName: 'sourcePageが有限数またはnullではない',
      body: { ...validBody, sourcePage: '34' },
      message: 'sourcePage must be a finite number or null',
    },
    {
      caseName: 'memoが文字列またはnullではない',
      body: { ...validBody, memo: true },
      message: 'memo must be a string or null',
    },
    {
      caseName: 'ingredientsが配列ではない',
      body: { ...validBody, ingredients: null },
      message: 'ingredients must be an array',
    },
    {
      caseName: '材料がオブジェクトではない',
      body: { ...validBody, ingredients: [null] },
      message: 'Each ingredient must be an object',
    },
    {
      caseName: 'ingredientNameが空',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: ' ', quantity: 1, unit: '個' }],
      },
      message: 'Each ingredient must have a valid ingredientName',
    },
    {
      caseName: 'ingredientNameが文字列ではない',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: 123, quantity: 1, unit: '個' }],
      },
      message: 'Each ingredient must have a valid ingredientName',
    },
    {
      caseName: '材料が配列',
      body: { ...validBody, ingredients: [[]] },
      message: 'Each ingredient must be an object',
    },
    {
      caseName: '材料がプリミティブ',
      body: { ...validBody, ingredients: ['塩'] },
      message: 'Each ingredient must be an object',
    },
    {
      caseName: 'ingredientNameが重複',
      body: {
        ...validBody,
        ingredients: [
          { ingredientName: '塩', quantity: 1, unit: 'g' },
          { ingredientName: '  塩  ', quantity: 2, unit: 'g' },
        ],
      },
      message: 'Duplicate ingredient name:   塩  ',
    },
    {
      caseName: '大文字小文字だけが異なるingredientNameが重複',
      body: {
        ...validBody,
        ingredients: [
          { ingredientName: 'Salt', quantity: 1, unit: 'g' },
          { ingredientName: 'salt', quantity: 2, unit: 'g' },
        ],
      },
      message: 'Duplicate ingredient name: salt',
    },
    {
      caseName: '数値quantityが0',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: '塩', quantity: 0, unit: 'g' }],
      },
      message: 'Each ingredient must have a positive numeric quantity or a non-empty text quantity',
    },
    {
      caseName: '文字列quantityが空',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: '塩', quantity: ' ', unit: 'g' }],
      },
      message: 'Each ingredient must have a positive numeric quantity or a non-empty text quantity',
    },
    {
      caseName: 'quantityが未対応型',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: '塩', quantity: true, unit: 'g' }],
      },
      message: 'Each ingredient must have a positive numeric quantity or a non-empty text quantity',
    },
    {
      caseName: 'unitが空',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: '塩', quantity: 1, unit: ' ' }],
      },
      message: 'Each ingredient must have a unit',
    },
    {
      caseName: 'unitが文字列ではない',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: '塩', quantity: 1, unit: 123 }],
      },
      message: 'Each ingredient must have a unit',
    },
    {
      caseName: 'noteが文字列またはnullではない',
      body: {
        ...validBody,
        ingredients: [{ ingredientName: '塩', quantity: 1, unit: 'g', note: 123 }],
      },
      message: 'Each ingredient note must be a string or null',
    },
  ])('$caseNameの場合は400を返す', async ({ body, message }) => {
    const response = await postRecipe(body);

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({
      error: { code: 'BAD_REQUEST', message, details: null },
    });
    expect(createRecipeWithIngredientsMock).not.toHaveBeenCalled();
  });

  it('repository例外時は500を返す', async () => {
    createRecipeWithIngredientsMock.mockRejectedValue(new Error('database error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    const response = await postRecipe(validBody);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create recipe',
        details: null,
      },
    });
    expect(consoleError).toHaveBeenCalled();
  });
});
