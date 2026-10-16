import { useEffect, useState, type ReactNode } from 'react';
import { useSession } from '../state/session';
import { applyTheme, currentTheme, type Theme } from '../theme';
import type { Health } from '../api/types';
import { Icon, type IconName } from './icons';
import { Logo } from './Logo';

const NAV: { path: string; label: string; icon: IconName }[] = [
  { path: '/overview', label: 'Огляд', icon: 'overview' },
  { path: '/orders', label: 'Наряди-замовлення СТО', icon: 'orders' },
  { path: '/about', label: 'Про систему', icon: 'about' },
];

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>(currentTheme);
  return (
    <button
      className="icon-btn"
      title={theme === 'dark' ? 'Світла тема' : 'Темна тема'}
      aria-label="Перемкнути тему"
      onClick={() => { const next: Theme = theme === 'dark' ? 'light' : 'dark'; applyTheme(next); setTheme(next); }}
    >
      <Icon name={theme === 'dark' ? 'sun' : 'moon'} />
    </button>
  );
}

function ConnectionChip() {
  const { api } = useSession();
  const [health, setHealth] = useState<Health | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    const tick = () => api.health().then((h) => alive && setHealth(h), () => alive && setHealth(null));
    tick();
    const id = window.setInterval(tick, 30000);
    return () => { alive = false; window.clearInterval(id); };
  }, [api]);
  if (health === undefined) return <span className="chip">Перевірка зв’язку…</span>;
  if (!health) return <span className="chip chip-bad" data-testid="conn">Немає зв’язку з сервером</span>;
  return <span className="chip chip-ok" data-testid="conn" title={`Платформа ${health.platform}`}>1С: {health.infobase} · {health.platform}</span>;
}

export function Shell({ route, navigate, children }: { route: string; navigate: (to: string) => void; children: ReactNode }) {
  const { user, logout } = useSession();
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className={'shell' + (collapsed ? ' collapsed' : '')}>
      <aside className="sidebar">
        <div className="brand">
          <Logo size={34} />
          {!collapsed && <div className="brand-text"><strong>Кермо</strong><span>ERP автодилера</span></div>}
        </div>
        <nav aria-label="Основна навігація">
          {NAV.map((n) => (
            <a key={n.path} href={'#' + n.path} className={'nav-item' + (route.startsWith(n.path) ? ' active' : '')} title={n.label} onClick={(e) => { e.preventDefault(); navigate(n.path); }}>
              <Icon name={n.icon} />
              {!collapsed && <span>{n.label}</span>}
            </a>
          ))}
        </nav>
        <button className="nav-item collapse" onClick={() => setCollapsed(!collapsed)} title={collapsed ? 'Розгорнути меню' : 'Згорнути меню'}>
          <Icon name={collapsed ? 'right' : 'left'} />
          {!collapsed && <span>Згорнути</span>}
        </button>
      </aside>
      <div className="main">
        <header className="topbar">
          <ConnectionChip />
          <div className="topbar-actions">
            <ThemeToggle />
            <span className="user" title="Поточний користувач 1С">{user}</span>
            <button className="icon-btn" title="Вийти" aria-label="Вийти" onClick={() => void logout()}><Icon name="logout" /></button>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
    </div>
  );
}
