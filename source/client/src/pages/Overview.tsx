import { useSession } from '../state/session';
import { useAsync } from '../useAsync';
import { formatDate, formatMoney, stateLabel, stateTone } from '../format';
import { Card, ErrorBox } from '../ui/bits';

export function Overview({ onOpenOrders }: { onOpenOrders: () => void }) {
  const { api } = useSession();
  const { data, error, loading } = useAsync(() => api.workOrderSummary(), [api]);
  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <div className="skeleton-grid" aria-busy="true"><div className="skeleton" /><div className="skeleton" /><div className="skeleton" /></div>;
  const max = Math.max(1, ...data.byState.map((s) => s.count));
  const rows = [...data.byState].sort((a, b) => b.count - a.count);
  return (
    <div className="page">
      <h2 className="page-title">Огляд</h2>
      <div className="kpis">
        <Card className="kpi"><span>Усього нарядів-замовлень</span><strong data-testid="kpi-total">{data.total.toLocaleString('uk-UA')}</strong><small>{formatDate(data.firstDate)} — {formatDate(data.lastDate)}</small></Card>
        <Card className="kpi"><span>Проведено</span><strong>{data.posted.toLocaleString('uk-UA')}</strong><small>{data.total ? Math.round((data.posted / data.total) * 100) : 0}% від усіх</small></Card>
        <Card className="kpi"><span>За останні 30 днів</span><strong>{data.last30Days.count.toLocaleString('uk-UA')}</strong><small>на суму {formatMoney(data.last30Days.amount)}</small></Card>
      </div>
      <Card title="Розподіл за станами">
        <ul className="bars">
          {rows.map((s) => (
            <li key={s.state}>
              <span className="bar-label">{stateLabel(s.state)}</span>
              <span className="bar-track"><span className={'bar-fill tone-' + stateTone(s.state)} style={{ width: `${Math.max(2, (s.count / max) * 100)}%` }} /></span>
              <span className="bar-value">{s.count.toLocaleString('uk-UA')}</span>
            </li>
          ))}
        </ul>
        <button className="btn" onClick={onOpenOrders}>Відкрити список нарядів-замовлень</button>
      </Card>
    </div>
  );
}
