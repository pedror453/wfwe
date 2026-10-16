export const FALLBACK_SERVER = 'http://127.0.0.1:8480';

/** Приводить введену адресу до вигляду http(s)://хост[:порт] без кінцевих слешів. */
export function normalizeServerInput(raw: string): string {
  const s = raw.trim();
  if (!s) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:\/\//i.test(s) ? s : `http://${s}`;
  return withScheme.replace(/\/+$/, '');
}

export interface LocationLike { protocol: string; origin: string; port: string }
export interface HostLike { serverUrl?: string }

/** Адреса сервера за замовчуванням: з налаштувань інсталятора, інакше сервер, що віддав клієнта, інакше локальний шлюз. */
export function defaultServer(loc: LocationLike, hostInfo: HostLike | null): string {
  if (hostInfo?.serverUrl) return hostInfo.serverUrl;
  if (loc.protocol.startsWith('http') && loc.port !== '5173' && loc.port !== '4173') return loc.origin;
  return FALLBACK_SERVER;
}
