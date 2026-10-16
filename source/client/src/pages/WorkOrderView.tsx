import { useState } from 'react';
import { useSession } from '../state/session';
import { useAsync } from '../useAsync';
import { formatDateTime, formatMoney, formatNumber } from '../format';
import { Card, ErrorBox, Field, StatePill } from '../ui/bits';
import { Icon, type IconName } from '../ui/icons';

type Tab = 'parts' | 'works' | 'performers';

export function WorkOrderView({ id, onBack }: { id: string; onBack: () => void }) {
  const { api, capabilities } = useSession();
  const { data: o, error, loading } = useAsync(() => api.workOrder(id), [api, id]);
  const [tab, setTab] = useState<Tab>('parts');
  if (error) return <div className="page"><button className="btn" onClick={onBack}><Icon name="back" size={16} /> До списку</button><ErrorBox error={error} /></div>;
  if (loading || !o) return <div className="page" aria-busy="true"><div className="skeleton tall" /></div>;

  const caps = capabilities?.workOrders;
  const note = (k: string) => capabilities?.notes?.[k] ?? 'Недоступно: запис документів ще не підключено (див. «Про систему»).';
  const actions: { key: string; label: string; icon: IconName; enabled: boolean }[] = [
    { key: 'update', label: 'Зберегти', icon: 'save', enabled: !!caps?.update },
    { key: 'post', label: 'Провести', icon: 'check', enabled: !!caps?.post },
    { key: 'unpost', label: 'Скасувати проведення', icon: 'close', enabled: !!caps?.unpost },
    { key: 'print', label: 'Друк', icon: 'print', enabled: !!caps?.print },
  ];
  const empty = (tab === 'parts' && !o.parts.length) || (tab === 'works' && !o.works.length) || (tab === 'performers' && !o.performers.length);

  return (
    <div className="page">
      <div className="detail-head">
        <button className="btn" onClick={onBack}><Icon name="back" size={16} /> До списку</button>
        <div className="detail-title">
          <h2>Наряд-замовлення № <span className="mono" data-testid="wo-number">{o.number}</span></h2>
          <span className="muted">від {formatDateTime(o.date)}</span>
          <StatePill state={o.state} />
          {o.posted ? <span className="pill pill-ok">Проведено</span> : <span className="pill pill-neutral">Не проведено</span>}
        </div>
        <div className="actions">
          {actions.map((a) => (
            <button key={a.key} className="btn" disabled={!a.enabled} title={a.enabled ? a.label : note(a.key)}>
              <Icon name={a.enabled ? a.icon : 'lock'} size={16} /> {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid-2">
        <Card title="Основне">
          <dl className="fields">
            <Field label="Організація">{o.organization?.name}</Field>
            <Field label="Замовник">{o.customer?.name}</Field>
            <Field label="Автомобіль">{o.car?.name}</Field>
            <Field label="Вид ремонту">{o.repairType?.name}</Field>
            <Field label="Майстер">{o.master?.name}</Field>
            <Field label="Менеджер">{o.manager?.name}</Field>
            <Field label="Початок">{formatDateTime(o.startDate)}</Field>
            <Field label="Закінчення">{formatDateTime(o.endDate)}</Field>
          </dl>
        </Card>
        <Card title="Підсумки">
          <dl className="fields totals">
            <Field label="Запчастини">{formatMoney(o.totalParts)}</Field>
            <Field label="Роботи">{formatMoney(o.totalWorks)}</Field>
            <Field label="Разом"><strong data-testid="wo-total">{formatMoney(o.total)}</strong></Field>
          </dl>
        </Card>
      </div>

      {(o.reason || o.recommendations) && (
        <Card title="Звернення клієнта">
          {o.reason && <p><span className="muted">Причина: </span>{o.reason}</p>}
          {o.recommendations && <p><span className="muted">Рекомендації: </span>{o.recommendations}</p>}
        </Card>
      )}

      <div className="tabs" role="tablist">
        {([['parts', `Запчастини (${o.parts.length})`], ['works', `Роботи (${o.works.length})`], ['performers', `Виконавці (${o.performers.length})`]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? 'tab active' : 'tab'} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>
      <div className="table-card">
        {tab === 'parts' && (
          <table className="table static"><thead><tr><th>Номенклатура</th><th className="num">Кількість</th><th>Од.</th><th className="num">Ціна</th><th className="num">Знижка, %</th><th>Склад</th><th className="num">Сума</th></tr></thead>
            <tbody>{o.parts.map((p, i) => (<tr key={i}><td>{p.item.name}</td><td className="num">{formatNumber(p.quantity)}</td><td>{p.unit?.name ?? '—'}</td><td className="num">{formatMoney(p.price)}</td><td className="num">{formatNumber(p.discountPercent ?? 0)}</td><td>{p.warehouse?.name ?? '—'}</td><td className="num">{formatMoney(p.amount)}</td></tr>))}</tbody>
          </table>
        )}
        {tab === 'works' && (
          <table className="table static"><thead><tr><th>Робота</th><th className="num">Кількість</th><th>Норма-години</th><th className="num">Ціна</th><th className="num">Знижка, %</th><th>Статус</th><th className="num">Сума</th></tr></thead>
            <tbody>{o.works.map((w, i) => (<tr key={i}><td>{w.work.name}</td><td className="num">{formatNumber(w.quantity)}</td><td>{w.normHours?.name ?? '—'}</td><td className="num">{formatMoney(w.price)}</td><td className="num">{formatNumber(w.discountPercent ?? 0)}</td><td>{w.status ?? '—'}</td><td className="num">{formatMoney(w.amount)}</td></tr>))}</tbody>
          </table>
        )}
        {tab === 'performers' && (
          <table className="table static"><thead><tr><th>Виконавець</th><th>Цех</th><th className="num">Відсоток</th></tr></thead>
            <tbody>{o.performers.map((p, i) => (<tr key={i}><td>{p.employee.name}</td><td>{p.workshop?.name ?? '—'}</td><td className="num">{formatNumber(p.percent ?? 0)}</td></tr>))}</tbody>
          </table>
        )}
        {empty && <p className="empty-line">Рядків немає.</p>}
      </div>
    </div>
  );
}
