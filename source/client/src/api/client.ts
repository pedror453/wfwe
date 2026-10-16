import type { Capabilities, Health, LoginResponse, Ref, WorkOrder, WorkOrderPage, WorkOrderQuery, WorkOrderSummaryReport } from './types';

export class ApiError extends Error {
  constructor(public status: number, message: string, public code?: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface Transport {
  baseUrl: string;
  token: string | null;
  onUnauthorized?: () => void;
  fetchFn?: typeof fetch;
}

export function qs(params: Record<string, string | number | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== '') p.set(k, String(v));
  }
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function createApi(transport: () => Transport) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const { baseUrl, token, onUnauthorized, fetchFn } = transport();
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (token) headers.Authorization = `Bearer ${token}`;
    let res: Response;
    try {
      res = await (fetchFn ?? fetch)(baseUrl.replace(/\/+$/, '') + path, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    } catch {
      throw new ApiError(0, 'Сервер недоступний. Перевірте адресу сервера та мережу.', 'network');
    }
    if (res.status === 204) return undefined as T;
    const text = await res.text();
    let data: unknown;
    if (text) {
      try { data = JSON.parse(text); } catch { data = undefined; }
    }
    if (!res.ok) {
      if (res.status === 401 && token) onUnauthorized?.();
      const p = (data ?? {}) as { detail?: string; title?: string; code?: string };
      throw new ApiError(res.status, p.detail || p.title || `Помилка сервера (${res.status})`, p.code);
    }
    return data as T;
  }

  return {
    health: () => request<Health>('GET', '/health'),
    capabilities: () => request<Capabilities>('GET', '/capabilities'),
    login: (user: string, password: string) => request<LoginResponse>('POST', '/auth/login', { user, password }),
    logout: () => request<void>('POST', '/auth/logout'),
    workOrders: (q: WorkOrderQuery) => request<WorkOrderPage>('GET', '/work-orders' + qs({ ...q })),
    workOrderSummary: () => request<WorkOrderSummaryReport>('GET', '/work-orders/summary'),
    workOrder: (id: string) => request<WorkOrder>('GET', `/work-orders/${encodeURIComponent(id)}`),
    lookups: (kind: string, q?: string) => request<Ref[]>('GET', `/lookups/${kind}` + qs({ q })),
  };
}

export type Api = ReturnType<typeof createApi>;
