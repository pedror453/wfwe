// Мок-шлюз «Кермо» для розробки та тестів інтерфейсу: синтетичні дані, ті самі шляхи, що в server/openapi.yaml.
import http from 'node:http';
import { randomBytes } from 'node:crypto';

const PORT = Number(process.env.PORT || 8480);
let seed = 20261016;
const rnd = () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const int = (a, b) => a + Math.floor(rnd() * (b - a + 1));
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const uuid = (kind, n) => `${String(kind).padStart(8, '0')}-0000-4000-8000-${String(n).padStart(12, '0')}`;
const mk = (kind, names) => names.map((name, i) => ({ id: uuid(kind, i + 1), name }));

const words = ['Альфа', 'Бриз', 'Вектор', 'Горизонт', 'Дельта', 'Едельвейс', 'Зеніт', 'Ітака', 'Кедр', 'Лідер', 'Меридіан', 'Нова'];
const customers = mk(1, [...words.map((w) => `ТОВ «${w}-Тест»`), ...Array.from({ length: 12 }, (_, i) => `Тестовий клієнт ${i + 1}`)]);
const models = ['Land Rover Discovery', 'Land Rover Defender', 'Range Rover Sport', 'Jaguar F-Pace', 'Jaguar E-Pace', 'Volvo XC60'];
const cars = mk(2, Array.from({ length: 30 }, (_, i) => `${models[i % models.length]} AA${1000 + i * 7}ТТ`));
const staff = mk(3, Array.from({ length: 10 }, (_, i) => `Співробітник ${i + 1}`));
const shops = mk(4, ['Цех 1 (механіка)', 'Цех 2 (кузов)', 'Діагностика']);
const wh = mk(5, ['Основний склад', 'Склад у виробництві']);
const parts = mk(6, ['Фільтр масляний', 'Фільтр повітряний', 'Колодки гальмівні передні', 'Диск гальмівний', 'Свічка запалювання', 'Мастило 5W-30 (л)', 'Рідина охолоджувальна', 'Щітка склоочисника'].flatMap((n) => [1, 2, 3].map((k) => `${n} #${k}`)));
const works = mk(7, ['Заміна мастила', 'Діагностика підвіски', 'Заміна гальмівних колодок', 'Комп’ютерна діагностика', 'Розвал-сходження', 'Заміна фільтрів', 'Мийка кузова']);
const units = mk(8, ['шт.', 'л', 'компл.']);
const org = { id: uuid(9, 1), name: 'ТОВ «Демо-Автоцентр»' };
const STATES = [['Закрыт', 62], ['Выполнен', 8], ['В работе', 9], ['Готово к выдаче', 6], ['Ожидание', 5], ['Заявка', 5], ['Дефектовка', 2], ['Закрыт с долгом', 2], ['Предварительная оплата', 1]];
const pickState = () => { let r = rnd() * 100, acc = 0; for (const [s, w] of STATES) { acc += w; if (r < acc) return s; } return 'Закрыт'; };
const round2 = (v) => Math.round(v * 100) / 100;

const ORDERS = [];
let when = new Date('2026-10-15T18:05:00').getTime();
for (let i = 0; i < 240; i++) {
  when -= int(1, 7) * 3600 * 1000;
  const state = pickState();
  const pl = Array.from({ length: int(0, 4) }, () => { const q = int(1, 4), price = round2(int(150, 6500) + rnd()), d = pick([0, 0, 5, 10]); return { item: pick(parts), quantity: q, unit: pick(units), price, discountPercent: d, warehouse: pick(wh), amount: round2(q * price * (1 - d / 100)) }; });
  const wl = Array.from({ length: int(1, 3) }, (_, k) => { const q = int(1, 3), price = round2(int(300, 2500) + rnd()); return { work: pick(works), lineKey: `L${k + 1}`, quantity: q, normHours: { id: uuid(10, k + 1), name: `${q}.0 н/г` }, price, discountPercent: 0, status: 'Виконано', amount: round2(q * price) }; });
  const totalParts = round2(pl.reduce((s, p) => s + p.amount, 0));
  const totalWorks = round2(wl.reduce((s, w) => s + w.amount, 0));
  ORDERS.push({
    id: uuid(11, i + 1), number: `ДЕМО-${String(137432 - i).padStart(8, '0')}`, date: new Date(when).toISOString().slice(0, 19), state,
    posted: ['Закрыт', 'Закрыт с долгом', 'Выполнен', 'Готово к выдаче'].includes(state) && rnd() > 0.02,
    organization: org, customer: pick(customers), car: pick(cars), master: pick(staff), manager: pick(staff), repairType: { id: uuid(12, 1), name: pick(['Платний ремонт', 'Гарантійний ремонт', 'ТО']) },
    reason: pick(['Планове технічне обслуговування', 'Стук у підвісці', 'Горить індикатор несправності', 'Заміна гальмівних колодок']), recommendations: pick(['', 'Перевірити стан сайлентблоків', 'Наступне ТО через 15 000 км']),
    startDate: new Date(when).toISOString().slice(0, 19), endDate: new Date(when + 5 * 3600 * 1000).toISOString().slice(0, 19),
    parts: pl, works: wl, performers: [{ lineKey: 'L1', employee: pick(staff), workshop: pick(shops), percent: 100 }], totalParts, totalWorks, total: round2(totalParts + totalWorks),
  });
}

const tokens = new Set();
const NOTE = 'Недоступно: запис у 1С 8.1 ще не підключено (див. «Про систему»).';
const bearer = (req) => (req.headers.authorization || '').replace(/^Bearer /, '');
const send = (res, status, body, type = 'application/json') => {
  res.writeHead(status, { 'Content-Type': type + '; charset=utf-8', 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Authorization, Content-Type, If-Match', 'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};
const problem = (res, status, title, detail) => send(res, status, { title, status, detail }, 'application/problem+json');
const slim = (o) => ({ id: o.id, number: o.number, date: o.date, state: o.state, posted: o.posted, customer: o.customer, car: o.car, total: o.total });

http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = url.pathname;
  if (req.method === 'OPTIONS') return send(res, 204);
  const open = p === '/health' || p === '/auth/login';
  if (!open && !tokens.has(bearer(req))) return problem(res, 401, 'Не авторизовано', 'Сесія завершена або недійсна. Увійдіть знову.');
  if (p === '/health') return send(res, 200, { status: 'ok', version: '0.1.0-mock', infobase: 'DEMO', platform: '8.1 (мок)' });
  if (p === '/auth/login' && req.method === 'POST') {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      let b = {};
      try { b = JSON.parse(raw); } catch { /* порожнє тіло */ }
      if (b.user === 'demo' && b.password === 'demo') { const token = randomBytes(16).toString('hex'); tokens.add(token); return send(res, 200, { token, expiresIn: 900, roles: ['Адміністратор'] }); }
      return problem(res, 401, 'Помилка входу', 'Неправильне ім’я користувача або пароль.');
    });
    return;
  }
  if (p === '/auth/logout') { tokens.delete(bearer(req)); return send(res, 204); }
  if (p === '/capabilities') return send(res, 200, { workOrders: { list: true, read: true, create: false, update: false, post: false, unpost: false, print: false }, notes: { create: NOTE, update: NOTE, post: NOTE, unpost: NOTE, print: 'Недоступно: друк буде додано після запису документів.' } });
  if (p === '/work-orders/summary') {
    const by = {};
    for (const o of ORDERS) by[o.state] = (by[o.state] || 0) + 1;
    const last = new Date(ORDERS[0].date).getTime(), recent = ORDERS.filter((o) => last - new Date(o.date).getTime() <= 30 * 86400000);
    return send(res, 200, { total: ORDERS.length, posted: ORDERS.filter((o) => o.posted).length, firstDate: ORDERS.at(-1).date, lastDate: ORDERS[0].date, byState: Object.entries(by).map(([state, count]) => ({ state, count })), last30Days: { count: recent.length, amount: round2(recent.reduce((s, o) => s + o.total, 0)) } });
  }
  if (p === '/work-orders') {
    const q = (url.searchParams.get('q') || '').toLowerCase(), st = url.searchParams.get('state') || '';
    const page = Math.max(1, Number(url.searchParams.get('page') || 1)), size = Math.min(200, Number(url.searchParams.get('pageSize') || 50));
    const list = ORDERS.filter((o) => (!st || o.state === st) && (!q || `${o.number} ${o.customer.name} ${o.car.name}`.toLowerCase().includes(q)));
    return send(res, 200, { items: list.slice((page - 1) * size, page * size).map(slim), total: list.length });
  }
  let m = p.match(/^\/work-orders\/([^/]+)$/);
  if (m) { const o = ORDERS.find((x) => x.id === decodeURIComponent(m[1])); return o ? send(res, 200, o) : problem(res, 404, 'Не знайдено', 'Наряд-замовлення не знайдено.'); }
  m = p.match(/^\/lookups\/([a-zA-Z]+)$/);
  if (m) {
    const src = { organizations: [org], customers, cars, employees: staff, nomenclature: parts, works, warehouses: wh, repairTypes: [{ id: uuid(12, 1), name: 'Платний ремонт' }] }[m[1]];
    if (!src) return problem(res, 404, 'Не знайдено', 'Невідомий довідник.');
    const q = (url.searchParams.get('q') || '').toLowerCase();
    return send(res, 200, src.filter((x) => !q || x.name.toLowerCase().includes(q)).slice(0, Number(url.searchParams.get('limit') || 30)));
  }
  return problem(res, 404, 'Не знайдено', 'Невідомий шлях.');
}).listen(PORT, '127.0.0.1', () => console.log(`Мок-шлюз Кермо: http://127.0.0.1:${PORT} (вхід demo / demo)`));
