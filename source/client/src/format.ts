const money = new Intl.NumberFormat('uk-UA', { style: 'currency', currency: 'UAH', maximumFractionDigits: 2 });
const dateTime = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'short', timeStyle: 'short' });
const dateOnly = new Intl.DateTimeFormat('uk-UA', { dateStyle: 'medium' });
const num = new Intl.NumberFormat('uk-UA', { maximumFractionDigits: 3 });

export const formatMoney = (v: number | null | undefined): string => (v == null ? '—' : money.format(v));
export const formatNumber = (v: number | null | undefined): string => (v == null ? '—' : num.format(v));
export const formatDateTime = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateTime.format(d);
};
export const formatDate = (iso?: string | null): string => {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '—' : dateOnly.format(d);
};

// Стани зберігаються в 1С російською; інтерфейс показує українські назви.
const STATE_UK: Record<string, string> = {
  'Заявка': 'Заявка',
  'Ожидание': 'Очікування',
  'В работе': 'У роботі',
  'Дефектовка': 'Дефектування',
  'Пост контроля качества': 'Пост контролю якості',
  'Пост моториста': 'Пост моториста',
  'Мойка': 'Мийка',
  'Готово к выдаче': 'Готово до видачі',
  'Выполнен': 'Виконано',
  'Закрыт': 'Закрито',
  'Закрыт с долгом': 'Закрито з боргом',
  'Предварительная оплата': 'Попередня оплата',
};

export type Tone = 'neutral' | 'progress' | 'ok' | 'warn' | 'done';

export const stateLabel = (s: string): string => STATE_UK[s] ?? s;

export function stateTone(s: string): Tone {
  switch (s) {
    case 'Закрыт': return 'done';
    case 'Закрыт с долгом': return 'warn';
    case 'Выполнен':
    case 'Готово к выдаче': return 'ok';
    case 'В работе':
    case 'Дефектовка':
    case 'Пост контроля качества':
    case 'Пост моториста':
    case 'Мойка': return 'progress';
    default: return 'neutral';
  }
}
