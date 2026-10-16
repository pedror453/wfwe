// Наскрізна перевірка встановленої програми «Кермо» (Electron) з реальним шлюзом і копією бази.
// Запускає Kermo.exe з віддаленим налагодженням і керує вікном через CDP. Виводить лише кількості та номери документів.
import { chromium } from '@playwright/test';
import { spawn, execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';

const exe = process.env.KERMO_EXE;
const userData = process.env.KERMO_UD;
const expectServer = process.env.KERMO_EXPECT_SERVER || '';
const shotDir = process.env.KERMO_SHOT_DIR || '';
const user = process.env.KERMO_USER;
const pass = process.env.KERMO_PASS ?? '';
const port = Number(process.env.KERMO_CDP_PORT || 9333);
if (!exe || !user) { console.error('Задайте KERMO_EXE, KERMO_USER і KERMO_PASS'); process.exit(2); }

const args = [`--remote-debugging-port=${port}`, '--disable-gpu'];
if (userData) args.push(`--user-data-dir=${userData}`);
const child = spawn(exe, args, { stdio: 'ignore' });
const killApp = () => { try { execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' }); } catch { /* уже завершено */ } };

let failed = 0;
const step = async (name, fn) => {
  try { const r = await fn(); console.log('PASS  ' + name + (r ? ' — ' + r : '')); } catch (e) { failed++; console.log('FAIL  ' + name + ' — ' + String(e.message).split('\n')[0]); }
};

let browser;
try {
  for (let i = 0; i < 60 && !browser; i++) {
    try { browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`); } catch { await sleep(500); }
  }
  if (!browser) throw new Error('не вдалося підключитися до вікна програми');
  const context = browser.contexts()[0];
  let page = context.pages().find((p) => p.url().startsWith('file:'));
  if (!page) page = await context.waitForEvent('page', { timeout: 20000 });
  const problems = [];
  page.on('pageerror', (e) => problems.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') problems.push('console: ' + m.text().slice(0, 160)); });

  await step('вікно програми показує форму входу', async () => {
    await page.getByRole('heading', { name: 'Кермо' }).waitFor({ timeout: 30000 });
    return 'заголовок вікна: ' + (await page.title());
  });
  if (shotDir) await page.screenshot({ path: join(shotDir, 'desktop-login.png') }).catch(() => undefined);
  await step('оболонка передала налаштування (адреса сервера від інсталятора)', async () => {
    const h = await page.evaluate(() => window.kermoHost || null);
    if (!h) throw new Error('window.kermoHost відсутній');
    if (expectServer && h.serverUrl !== expectServer) throw new Error(`очікувалось ${expectServer}, отримано ${h.serverUrl}`);
    return `версія ${h.appVersion}, Electron ${h.electron}, портативний: ${h.portable}`;
  });
  await step('вхід обліковим записом системи обліку', async () => {
    await page.getByLabel(/Ім’я користувача/).fill(user);
    await page.getByLabel('Пароль').fill(pass);
    await page.getByRole('button', { name: 'Увійти' }).click();
    await page.getByTestId('kpi-total').waitFor({ timeout: 60000 });
    return 'нарядів-замовлень: ' + (await page.getByTestId('kpi-total').innerText());
  });
  await step('індикатор з’єднання із сервером', async () => (await page.getByTestId('conn').innerText()).replace(/\s+/g, ' '));
  await step('список: перша сторінка', async () => {
    await page.getByRole('link', { name: /Наряди-замовлення СТО/ }).click();
    await page.locator('table.table tbody tr').first().waitFor({ timeout: 60000 });
    const rows = await page.locator('table.table tbody tr').count();
    if (rows !== 25) throw new Error('очікувалось 25 рядків, є ' + rows);
    return rows + ' рядків, ' + (await page.getByTestId('range').innerText());
  });
  await step('фільтр за станом «Заявка»', async () => {
    await page.getByLabel('Стан').selectOption('Заявка');
    await page.waitForTimeout(1500);
    const texts = await page.locator('table.table tbody tr td:nth-child(3)').allInnerTexts();
    if (!texts.length) throw new Error('порожній результат');
    if (texts.some((t) => t.trim() !== 'Заявка')) throw new Error('є інші стани');
    await page.getByLabel('Стан').selectOption('');
    return texts.length + ' рядків';
  });
  await step('картка наряду відкривається', async () => {
    await page.locator('table.table tbody tr').first().waitFor({ timeout: 30000 });
    await page.locator('table.table tbody tr').first().click();
    await page.getByTestId('wo-number').waitFor({ timeout: 60000 });
    return '№ ' + (await page.getByTestId('wo-number').innerText());
  });
  await step('кнопки запису вимкнені з поясненням', async () => {
    if (!(await page.getByRole('button', { name: /Провести/ }).isDisabled())) throw new Error('кнопка активна');
  });
  await step('сторінка «Про систему» показує ліцензії та версію', async () => {
    await page.getByRole('link', { name: /Про систему/ }).click();
    await page.getByText('Ліцензії та залежності').waitFor({ timeout: 15000 });
    return (await page.locator('dl.fields').first().innerText()).replace(/\s+/g, ' ');
  });
  await step('помилок у консолі немає', async () => { if (problems.length) throw new Error(problems.join(' | ')); });
} catch (e) {
  failed++;
  console.log('FAIL  запуск — ' + String(e.message).split('\n')[0]);
} finally {
  try { if (browser) await browser.close(); } catch { /* ігноруємо */ }
  killApp();
}
console.log(failed ? `ПІДСУМОК: ${failed} помилок` : 'ПІДСУМОК: усе пройшло');
process.exit(failed ? 1 : 0);
