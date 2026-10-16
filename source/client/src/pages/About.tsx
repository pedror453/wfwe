import { useSession } from '../state/session';
import { useAsync } from '../useAsync';
import { host } from '../host';
import { Card, Field } from '../ui/bits';

type Status = 'працює' | 'частково' | 'не реалізовано' | 'заблоковано';
const MATRIX: { name: string; status: Status; note: string }[] = [
  { name: 'Вхід обліковим записом системи обліку', status: 'працює', note: 'Права доступу визначає сервер; пароль не зберігається.' },
  { name: 'Список і пошук нарядів-замовлень', status: 'працює', note: 'Пошук за номером, замовником, автомобілем і VIN; фільтр за станом.' },
  { name: 'Картка наряду-замовлення (перегляд)', status: 'працює', note: 'Шапка, запчастини, роботи, виконавці.' },
  { name: 'Створення, редагування, проведення', status: 'не реалізовано', note: 'Сервер уже готовий до запису документів через шлюз; API запису в розробці.' },
  { name: 'Друк', status: 'не реалізовано', note: 'Друковані форми буде додано після запису документів.' },
  { name: 'Інші модулі (склад, каса, продаж авто)', status: 'не реалізовано', note: 'Додаються лише після перевірки в аудиті.' },
];
const tone = (s: Status) => (s === 'працює' ? 'pill-ok' : s === 'частково' ? 'pill-progress' : s === 'заблоковано' ? 'pill-warn' : 'pill-neutral');

const LICENSES: [string, string][] = [
  ['Платформа 1С:Підприємство 8.1 (сервер обліку)', 'Комерційна. Потрібні ліцензії 1С: кожен вхід користувача Кермо займає окремий сеанс 1С. Кермо не містить і не поширює компонентів 1С.'],
  ['Microsoft SQL Server', 'Комерційна. Сервер бази даних системи обліку.'],
  ['Electron, Chromium', 'Оболонка Windows-програми; ліцензії MIT, BSD та інші. Повні тексти — у файлах LICENSE.electron.txt і LICENSES.chromium.html поруч із програмою.'],
  ['React, Vite', 'Інтерфейс програми; ліцензія MIT.'],
];

export function About() {
  const { api, baseUrl, capabilities } = useSession();
  const health = useAsync(() => api.health(), [api]);
  const gateway = health.data ? `${health.data.version} (платформа ${health.data.platform})` : health.error ? 'недоступний' : '…';
  return (
    <div className="page">
      <h2 className="page-title">Про систему</h2>
      <Card title="Кермо">
        <p>Клієнт працює через захищений шлюз і виконує всі бізнес-операції на сервері обліку. Дані напряму в таблицях СУБД не змінюються.</p>
        <dl className="fields">
          <Field label="Версія програми">{host ? host.appVersion : 'веб-версія (у браузері)'}</Field>
          <Field label="Режим">{host ? (host.portable ? 'програма Windows, портативний режим' : 'програма Windows') : 'браузер'}</Field>
          <Field label="Сервер">{baseUrl}</Field>
          <Field label="Шлюз">{gateway}</Field>
        </dl>
      </Card>
      <Card title="Стан функцій">
        <table className="table static"><thead><tr><th>Функція</th><th>Статус</th><th>Примітка</th></tr></thead>
          <tbody>{MATRIX.map((m) => (<tr key={m.name}><td>{m.name}</td><td><span className={'pill ' + tone(m.status)}>{m.status}</span></td><td>{m.note}</td></tr>))}</tbody>
        </table>
        {capabilities && <p className="muted">Можливості шлюзу: {Object.entries(capabilities.workOrders).map(([k, v]) => `${k}: ${v ? 'так' : 'ні'}`).join(', ')}.</p>}
      </Card>
      <Card title="Ліцензії та залежності">
        <table className="table static"><thead><tr><th>Компонент</th><th>Ліцензування</th></tr></thead>
          <tbody>{LICENSES.map(([name, note]) => (<tr key={name}><td>{name}</td><td>{note}</td></tr>))}</tbody>
        </table>
      </Card>
    </div>
  );
}
