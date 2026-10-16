import { describe, expect, it } from 'vitest';
import { formatDateTime, formatMoney, stateLabel, stateTone } from './format';

describe('format', () => {
  it('форматує гривню з двома знаками', () => {
    expect(formatMoney(1234.5).replace(/\s/g, ' ')).toContain('1 234,50');
    expect(formatMoney(null)).toBe('—');
  });
  it('повертає тире для порожньої або хибної дати', () => {
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('не дата')).toBe('—');
    expect(formatDateTime('2026-10-15T18:05:36')).toMatch(/15\.10\.2026|15\.10\.26/);
  });
  it('перекладає стани 1С українською і не губить невідомі', () => {
    expect(stateLabel('Закрыт')).toBe('Закрито');
    expect(stateLabel('В работе')).toBe('У роботі');
    expect(stateLabel('Новий невідомий')).toBe('Новий невідомий');
  });
  it('підбирає тон стану', () => {
    expect(stateTone('Закрыт')).toBe('done');
    expect(stateTone('Закрыт с долгом')).toBe('warn');
    expect(stateTone('В работе')).toBe('progress');
    expect(stateTone('Заявка')).toBe('neutral');
  });
});
