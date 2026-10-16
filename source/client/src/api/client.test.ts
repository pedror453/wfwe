import { describe, expect, it, vi } from 'vitest';
import { ApiError, createApi, qs } from './client';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  it('будує рядок запиту без порожніх значень', () => {
    expect(qs({ q: 'а б', state: '', page: 2 })).toBe('?q=%D0%B0+%D0%B1&page=2');
    expect(qs({})).toBe('');
  });

  it('додає токен і розбирає відповідь', async () => {
    const fetchFn = vi.fn(async () => json(200, { items: [], total: 0 }));
    const api = createApi(() => ({ baseUrl: 'http://x/', token: 't1', fetchFn: fetchFn as unknown as typeof fetch }));
    await expect(api.workOrders({ page: 1 })).resolves.toEqual({ items: [], total: 0 });
    const [url, init] = fetchFn.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('http://x/work-orders?page=1');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer t1');
  });

  it('перетворює problem+json на ApiError і викликає onUnauthorized для 401', async () => {
    const onUnauthorized = vi.fn();
    const fetchFn = vi.fn(async () => json(401, { title: 'Не авторизовано', detail: 'Сесія завершена' }));
    const api = createApi(() => ({ baseUrl: 'http://x', token: 't', onUnauthorized, fetchFn: fetchFn as unknown as typeof fetch }));
    await expect(api.health()).rejects.toMatchObject({ status: 401, message: 'Сесія завершена' });
    expect(onUnauthorized).toHaveBeenCalledOnce();
  });

  it('повідомляє українською, коли сервер недоступний', async () => {
    const fetchFn = vi.fn(async () => { throw new TypeError('fail'); });
    const api = createApi(() => ({ baseUrl: 'http://x', token: null, fetchFn: fetchFn as unknown as typeof fetch }));
    const err = await api.health().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect((err as ApiError).code).toBe('network');
    expect((err as ApiError).message).toContain('Сервер недоступний');
  });
});
