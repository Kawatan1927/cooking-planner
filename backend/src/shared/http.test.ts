import { describe, expect, it } from 'vitest';
import {
  badRequest,
  errorResponse,
  internalServerError,
  jsonResponse,
  noContent,
  notFound,
} from './http';

describe('success responses', () => {
  it('statusとbodyを保持する', () => {
    expect(jsonResponse(201, { id: 'recipe-id' })).toEqual({
      status: 201,
      body: { id: 'recipe-id' },
    });
  });

  it('204ではbodyを持たない', () => {
    expect(noContent()).toEqual({ status: 204 });
  });
});

describe('error responses', () => {
  it('指定したstatus、code、message、detailsを保持する', () => {
    expect(errorResponse(422, 'INVALID_VALUE', 'Invalid value', { field: 'name' })).toEqual({
      status: 422,
      body: {
        error: {
          code: 'INVALID_VALUE',
          message: 'Invalid value',
          details: { field: 'name' },
        },
      },
    });
  });

  it.each([
    [badRequest, 400, 'BAD_REQUEST'],
    [notFound, 404, 'NOT_FOUND'],
    [internalServerError, 500, 'INTERNAL_SERVER_ERROR'],
  ] as const)('既定のエラー形式を返す', (factory, status, code) => {
    expect(factory('message')).toEqual({
      status,
      body: { error: { code, message: 'message', details: null } },
    });
  });

  it('helperでcodeを上書きできる', () => {
    expect(notFound('Recipe not found', 'RECIPE_NOT_FOUND')).toEqual({
      status: 404,
      body: {
        error: {
          code: 'RECIPE_NOT_FOUND',
          message: 'Recipe not found',
          details: null,
        },
      },
    });
  });
});
