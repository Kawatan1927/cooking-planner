import type { Context } from 'hono';
import { describe, expect, it } from 'vitest';
import { adapt, resultToResponse } from './adapt';

describe('resultToResponse', () => {
  it('JSON bodyとstatusとContent-TypeをResponseへ変換する', async () => {
    const response = resultToResponse({
      status: 201,
      body: { id: 'recipe-id' },
    });
    expect(response.status).toBe(201);
    expect(response.headers.get('content-type')).toBe('application/json; charset=utf-8');
    expect(await response.json()).toEqual({ id: 'recipe-id' });
  });

  it('204ではbodyとJSON用headerを付けない', async () => {
    const response = resultToResponse({ status: 204 });
    expect(response.status).toBe(204);
    expect(response.headers.get('content-type')).toBeNull();
    expect(await response.text()).toBe('');
  });
});

describe('adapt', () => {
  const context = {} as Context;

  it('同期handlerの結果をResponseへ変換する', async () => {
    const response = await adapt(() => ({ status: 200, body: { ok: true } }))(context);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('非同期handlerの結果をResponseへ変換する', async () => {
    const response = await adapt(async () => ({
      status: 202,
      body: { accepted: true },
    }))(context);
    expect(response.status).toBe(202);
    expect(await response.json()).toEqual({ accepted: true });
  });
});
