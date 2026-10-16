import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createApi, type Api } from '../api/client';
import type { Capabilities } from '../api/types';

// Коли клієнт відкрито зі шлюзу (той самий хост), звертаємося до нього ж; у розробці й в оболонці Electron — до локального шлюзу.
export const DEFAULT_SERVER = (() => {
  const { protocol, origin, port } = window.location;
  return protocol.startsWith('http') && port !== '5173' && port !== '4173' ? origin : 'http://127.0.0.1:8480';
})();

interface SessionValue {
  baseUrl: string;
  setBaseUrl: (v: string) => void;
  token: string | null;
  user: string | null;
  roles: string[];
  capabilities: Capabilities | null;
  api: Api;
  login: (user: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const Ctx = createContext<SessionValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [baseUrl, setBase] = useState(() => localStorage.getItem('kermo.server') ?? DEFAULT_SERVER);
  const [token, setToken] = useState<string | null>(() => sessionStorage.getItem('kermo.token'));
  const [user, setUser] = useState<string | null>(() => sessionStorage.getItem('kermo.user'));
  const [roles, setRoles] = useState<string[]>([]);
  const [capabilities, setCapabilities] = useState<Capabilities | null>(null);
  const live = useRef({ baseUrl, token });
  live.current = { baseUrl, token };

  const clear = useCallback(() => {
    sessionStorage.removeItem('kermo.token');
    sessionStorage.removeItem('kermo.user');
    setToken(null);
    setUser(null);
    setRoles([]);
    setCapabilities(null);
  }, []);

  const api = useMemo(() => createApi(() => ({ ...live.current, onUnauthorized: clear })), [clear]);

  const setBaseUrl = useCallback((v: string) => {
    localStorage.setItem('kermo.server', v);
    setBase(v);
  }, []);

  useEffect(() => {
    if (!token) return;
    api.capabilities().then(setCapabilities, () => undefined);
  }, [token, api]);

  const login = useCallback(async (u: string, password: string) => {
    live.current = { ...live.current, token: null };
    const res = await api.login(u, password);
    live.current = { ...live.current, token: res.token };
    sessionStorage.setItem('kermo.token', res.token);
    sessionStorage.setItem('kermo.user', u);
    setUser(u);
    setRoles(res.roles ?? []);
    setToken(res.token);
  }, [api]);

  const logout = useCallback(async () => {
    try { await api.logout(); } catch { /* сесія могла вже завершитися */ }
    clear();
  }, [api, clear]);

  const value = useMemo<SessionValue>(
    () => ({ baseUrl, setBaseUrl, token, user, roles, capabilities, api, login, logout }),
    [baseUrl, setBaseUrl, token, user, roles, capabilities, api, login, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSession(): SessionValue {
  const v = useContext(Ctx);
  if (!v) throw new Error('SessionProvider відсутній');
  return v;
}
