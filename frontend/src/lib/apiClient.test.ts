import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, apiFetch } from './apiClient';

const jsonResponse = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });

describe('apiFetch request', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it.each([
    ['https://example.com/api', '/recipes'],
    ['https://example.com/api/', '/recipes'],
    ['https://example.com/api', 'recipes'],
    ['https://example.com/api/', 'recipes'],
  ])('base URLが%s、pathが%sでもURLを正規化する', async (baseUrl, path) => {
    vi.stubEnv('VITE_API_BASE_URL', baseUrl);
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch(path);

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/recipes',
      expect.objectContaining({ credentials: 'include' })
    );
  });

  it('bodyをJSON化し既存headerとContent-Typeを設定する', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: 'recipe-1' }));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/recipes', {
      method: 'POST',
      headers: { 'X-Request-Id': 'request-1' },
      body: { name: 'カレー' },
    });

    expect(fetchMock).toHaveBeenCalledWith('https://example.com/api/recipes', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'X-Request-Id': 'request-1',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'カレー' }),
    });
  });

  it('明示したcredentialsを尊重する', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse([]));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/recipes', { credentials: 'omit' });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/recipes',
      expect.objectContaining({ credentials: 'omit' })
    );
  });
});

describe('apiFetch response', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('JSON成功レスポンスを返す', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonResponse({ id: 'recipe-1' })));

    await expect(apiFetch<{ id: string }>('/recipes/recipe-1')).resolves.toEqual({
      id: 'recipe-1',
    });
  });

  it('204レスポンスではnullを返す', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));

    await expect(apiFetch<null>('/menus/menu-1', { method: 'DELETE' })).resolves.toBeNull();
  });

  it('非JSON成功レスポンスではnullを返す', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('accepted', {
          status: 202,
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    );

    await expect(apiFetch<null>('/jobs')).resolves.toBeNull();
  });

  it('構造化JSONエラーからApiErrorを生成する', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        jsonResponse(
          {
            error: {
              code: 'VALIDATION_ERROR',
              message: '入力値が不正です',
              details: { field: 'name' },
            },
          },
          { status: 400 }
        )
      )
    );

    const error = await apiFetch('/recipes').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: '入力値が不正です',
      details: { field: 'name' },
    });
  });

  it('非JSONエラーの本文からUNKNOWN_ERRORを生成する', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response('Service unavailable', {
          status: 503,
          statusText: 'Service Unavailable',
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    );

    const error = await apiFetch('/recipes').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      statusCode: 503,
      code: 'UNKNOWN_ERROR',
      message: 'Service unavailable',
    });
  });

  it('非JSONエラーの本文が空ならstatus textをmessageにする', async () => {
    vi.stubEnv('VITE_API_BASE_URL', 'https://example.com/api');
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(null, {
          status: 502,
          statusText: 'Bad Gateway',
          headers: { 'Content-Type': 'text/plain' },
        })
      )
    );

    await expect(apiFetch('/recipes')).rejects.toMatchObject({
      statusCode: 502,
      code: 'UNKNOWN_ERROR',
      message: 'Bad Gateway',
    });
  });
});
