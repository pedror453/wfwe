import { useEffect, useState } from 'react';
import { useSession } from '../state/session';
import { useAsync } from '../useAsync';
import { formatDateTime, formatMoney, stateLabel } from '../format';
import { Empty, ErrorBox, StatePill } from '../ui/bits';
import { Icon } from '../ui/icons';

const PAGE_SIZE = 25;
const STATES = ['Заявка', 'Ожидание', 'В работе', 'Дефектовка', 'Пост контроля качества', 'Пост моториста', 'Мойка', 'Готово к выдаче', 'Выполнен', 'Закрыт', 'Закрыт с долгом', 'Предварительная оплата'];

export function WorkOrders({ onOpen }: { onOpen: (id: string) => void }) {
  const { api } = useSession();
  const [input, setInput] = useState('');
  const [q, setQ] = useState('');
  const [state, setState] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => { setQ(input.trim()); setPage(1); }, 300);
    return () => window.clearTimeout(t);
  }, [input]);

  const { data, error, loading } = useAsync(() => api.workOrders({ q, state, page, pageSize: PAGE_SIZE }), [api, q, state, page]);
  const total = data?.total ?? 0;
  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(total, page * PAGE_SIZE);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="page">
      <h2 className="page-title">Наряди-замовлення СТО</h2>
      <div className="toolbar">
        <label className="search">
          <Icon name="search" />
          <input type="search" placeholder="Пошук: номер, замовник, автомобіль" value={input} onChange={(e) => setInput(e.target.value)} aria-label="Пошук" />
        </label>
        <select value={state} onChange={(e) => { setState(e.target.value); setPage(1); }} aria-label="Стан">
          <option value="">Усі стани</option>
          {STATES.map((s) => <option key={s} value={s}>{stateLabel(s)}</option>)}
        </select>
      </div>
      {error ? <ErrorBox error={error} /> : (
        <div className="table-card" aria-busy={loading}>
          <table className="table">
            <thead><tr><th>Номер</th><th>Дата</th><th>Стан</th><th>Замовник</th><th>Автомобіль</th><th className="num">Сума</th><th>Проведено</th></tr></thead>
            <tbody>
              {(data?.items ?? []).map((o) => (
                <tr key={o.id} tabIndex={0} onClick={() => onOpen(o.id)} onKeyDown={(e) => { if (e.key === 'Enter') onOpen(o.id); }}>
                  <td className="mono">{o.number}</td>
                  <td>{formatDateTime(o.date)}</td>
                  <td><StatePill state={o.state} /></td>
                  <td>{o.customer?.name || '—'}</td>
                  <td>{o.car?.name || '—'}</td>
                  <td className="num">{formatMoney(o.total)}</td>
                  <td>{o.posted ? <span className="ok-mark" title="Проведено"><Icon name="check" size={16} /></span> : <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!loading && data && data.items.length === 0 && <Empty title="Нічого не знайдено" hint="Змініть пошуковий запит або фільтр стану." />}
          {loading && !data && <div className="skeleton-rows" aria-hidden="true">{Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton" />)}</div>}
        </div>
      )}
      <div className="pager">
        <span data-testid="range">{total ? `Показано ${from}–${to} з ${total.toLocaleString('uk-UA')}` : ''}</span>
        <div>
          <button className="btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}><Icon name="left" size={16} /> Назад</button>
          <span className="page-no">{page} / {pages}</span>
          <button className="btn" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>Далі <Icon name="right" size={16} /></button>
        </div>
      </div>
    </div>
  );
}
