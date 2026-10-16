import { useState, type FormEvent } from 'react';
import { useSession } from '../state/session';
import { host, isDesktop } from '../host';
import { normalizeServerInput } from '../server-url';
import { Logo } from '../ui/Logo';
import { ThemeToggle } from '../ui/Shell';

export function Login() {
  const { baseUrl, setBaseUrl, login } = useSession();
  // У Windows-програмі без налаштованої адреси одразу показуємо поле адреси сервера.
  const needsServer = isDesktop && !host?.serverUrl && !localStorage.getItem('kermo.server');
  const [user, setUser] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(baseUrl);
  const [advanced, setAdvanced] = useState(needsServer);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const address = normalizeServerInput(server);
      setServer(address);
      setBaseUrl(address);
      await login(user.trim(), password);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-wrap">
      <div className="login-theme"><ThemeToggle /></div>
      <form className="login-card" onSubmit={submit} aria-labelledby="login-title">
        <div className="login-brand"><Logo size={52} /><div><h1 id="login-title">Кермо</h1><p>ERP автодилера</p></div></div>
        <label>Ім’я користувача
          <input autoFocus autoComplete="username" value={user} onChange={(e) => setUser(e.target.value)} required />
        </label>
        <label>Пароль
          <input type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {advanced && (
          <label>Адреса сервера
            <input value={server} onChange={(e) => setServer(e.target.value)} placeholder="http://адреса:8480" inputMode="url" />
            {needsServer && <small className="muted">Адресу сервера надає адміністратор, наприклад http://192.168.0.10:8480</small>}
          </label>
        )}
        {error && <div className="error-inline" role="alert">{error}</div>}
        <button className="btn btn-primary" type="submit" disabled={busy || !user.trim()}>{busy ? 'Вхід…' : 'Увійти'}</button>
        <button className="link" type="button" onClick={() => setAdvanced(!advanced)}>{advanced ? 'Сховати налаштування' : 'Налаштування підключення'}</button>
        <p className="login-note">Використовуйте ім’я користувача та пароль від системи обліку. Пароль не зберігається.</p>
      </form>
    </div>
  );
}
