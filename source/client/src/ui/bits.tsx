import type { ReactNode } from 'react';
import { stateLabel, stateTone } from '../format';

export const StatePill = ({ state }: { state: string }) => (
  <span className={'pill pill-' + stateTone(state)}>{stateLabel(state)}</span>
);

export const Empty = ({ title, hint }: { title: string; hint?: string }) => (
  <div className="empty"><strong>{title}</strong>{hint && <p>{hint}</p>}</div>
);

export const ErrorBox = ({ error, retry }: { error: Error; retry?: () => void }) => (
  <div className="error-box" role="alert">
    <strong>Не вдалося завантажити дані</strong>
    <p>{error.message}</p>
    {retry && <button className="btn" onClick={retry}>Повторити</button>}
  </div>
);

export const Card = ({ title, children, className }: { title?: string; children: ReactNode; className?: string }) => (
  <section className={'card ' + (className ?? '')}>{title && <h3>{title}</h3>}{children}</section>
);

export const Field = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="field"><dt>{label}</dt><dd>{children || '—'}</dd></div>
);
