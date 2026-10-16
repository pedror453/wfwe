import { useSession } from '../state/session';
import { Card } from '../ui/bits';

type Status = 'працює' | 'частково' | 'не реалізовано' | 'заблоковано';
const MATRIX: { name: string; status: Status; note: string }[] = [
  { name: 'Вхід обліковим записом 1С', status: 'працює', note: 'Перевірено на копії бази (1С 8.1.15.14).' },
  { name: 'Список і пошук нарядів-замовлень', status: 'працює', note: 'Читання з 1С запитами; ліцензії 1С використовує шлюз.' },
  { name: 'Картка наряду-замовлення (перегляд)', status: 'працює', note: 'Шапка, запчастини, роботи, виконавці.' },
  { name: 'Створення, редагування, проведення', status: 'не реалізовано', note: 'Модулі 1С уже компілюються у зовнішньому з’єднанні (перевірено на копії); API запису в розробці.' },
  { name: 'Друк', status: 'не реалізовано', note: 'Друковані форми 1С будуть додані після запису документів.' },
  { name: 'Інші модулі (склад, каса, продаж авто)', status: 'не реалізовано', note: 'Додаються лише після перевірки в аудиті.' },
];
const tone = (s: Status) => (s === 'працює' ? 'pill-ok' : s === 'частково' ? 'pill-progress' : s === 'заблоковано' ? 'pill-warn' : 'pill-neutral');

export function About() {
  const { capabilities } = useSession();
  return (
    <div className="page">
      <h2 className="page-title">Про систему</h2>
      <Card title="Кермо · версія 0.1 (режим сумісності з 1С 8.1)">
        <p>Клієнт працює через захищений шлюз і виконує всі бізнес-операції в 1С. Дані напряму в таблицях СУБД не змінюються.</p>
      </Card>
      <Card title="Стан функцій">
        <table className="table static"><thead><tr><th>Функція</th><th>Статус</th><th>Примітка</th></tr></thead>
          <tbody>{MATRIX.map((m) => (<tr key={m.name}><td>{m.name}</td><td><span className={'pill ' + tone(m.status)}>{m.status}</span></td><td>{m.note}</td></tr>))}</tbody>
        </table>
        {capabilities && <p className="muted">Поточні можливості шлюзу: {Object.entries(capabilities.workOrders).map(([k, v]) => `${k}: ${v ? 'так' : 'ні'}`).join(', ')}.</p>}
      </Card>
    </div>
  );
}
