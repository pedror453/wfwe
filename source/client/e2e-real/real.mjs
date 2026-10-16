// Наскрізна перевірка клієнта з реальним шлюзом і копією бази. Виводить лише кількості та номери документів
// (без імен клієнтів, VIN тощо), знімків екрана не зберігає. Облікові дані беруться зі змінних середовища.
import { chromium } from '@playwright/test';

const base = process.env.KERMO_URL || 'http://127.0.0.1:8480';
const user = process.env.KERMO_USER;
const pass = process.env.KERMO_PASS ?? '';
if (!user) { console.error('Задайте KERMO_USER і KERMO_PASS'); process.exit(2); }

const browser = await chromium.launch({ channel: process.env.KERMO_BROWSER || 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1360, height: 860 }, locale: 'uk-UA' });
const problems = [];
page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 160)); });
let failed = 0;
const step = async (name, fn) => {
  try { const r = await fn(); console.log('PASS  ' + name + (r ? ' — ' + r : '')); } catch (e) { failed++; console.log('FAIL  ' + name + ' — ' + String(e.message).split('\n')[0]); }
};

await page.goto(base);
await step('форма входу відкрилась', async () => { await page.getByRole('heading', { name: 'Кермо' }).waitFor({ timeout: 15000 }); });
await step('вхід обліковим записом 1С', async () => {
  await page.getByLabel(/Ім’я користувача/).fill(user);
  await page.getByLabel('Пароль').fill(pass);
  await page.getByRole('button', { name: 'Увійти' }).click();
  await page.getByTestId('kpi-total').waitFor({ timeout: 45000 });
  return 'нарядів-замовлень: ' + (await page.getByTestId('kpi-total').innerText());
});
await step('індикатор з’єднання з 1С', async () => (await page.getByTestId('conn').innerText()).replace(/\s+/g, ' '));
await step('список: перша сторінка', async () => {
  await page.getByRole('link', { name: /Наряди-замовлення СТО/ }).click();
  await page.locator('table.table tbody tr').first().waitFor({ timeout: 45000 });
  const rows = await page.locator('table.table tbody tr').count();
  if (rows !== 25) throw new Error('очікувалось 25 рядків, є ' + rows);
  return rows + ' рядків, ' + (await page.getByTestId('range').innerText());
});
await step('стан-фільтр "Заявка" лишає тільки заявки', async () => {
  await page.getByLabel('Стан').selectOption('Заявка');
  await page.waitForTimeout(1500);
  const rows = page.locator('table.table tbody tr');
  const n = await rows.count();
  if (n === 0) throw new Error('порожній результат');
  const texts = await rows.locator('td:nth-child(3)').allInnerTexts();
  if (texts.some((t) => t.trim() !== 'Заявка')) throw new Error('є інші стани');
  await page.getByLabel('Стан').selectOption('');
  return n + ' рядків';
});
await step('картка наряду відкривається', async () => {
  await page.locator('table.table tbody tr').first().waitFor({ timeout: 30000 });
  await page.locator('table.table tbody tr').first().click();
  await page.getByTestId('wo-number').waitFor({ timeout: 45000 });
  return '№ ' + (await page.getByTestId('wo-number').innerText()) + ', вкладок: ' + (await page.getByRole('tab').count());
});
await step('кнопки запису вимкнені з поясненням', async () => {
  const disabled = await page.getByRole('button', { name: /Провести/ }).isDisabled();
  if (!disabled) throw new Error('кнопка активна');
});
await step('помилок у консолі браузера немає', async () => { if (problems.length) throw new Error(problems.join(' | ')); });
await browser.close();
console.log(failed ? `ПІДСУМОК: ${failed} помилок` : 'ПІДСУМОК: усе пройшло');
process.exit(failed ? 1 : 0);
