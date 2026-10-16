import { expect, test } from '@playwright/test';

const shot = (name: string) => `test-results/${name}.png`;

test('вхід, огляд, список, картка й теми', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Кермо' })).toBeVisible();
  await page.screenshot({ path: shot('01-login-light') });

  await page.getByLabel(/Ім’я користувача/).fill('demo');
  await page.getByLabel('Пароль').fill('невірний');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByRole('alert')).toContainText('Неправильне ім’я користувача або пароль');

  await page.getByLabel('Пароль').fill('demo');
  await page.getByRole('button', { name: 'Увійти' }).click();
  await expect(page.getByTestId('kpi-total')).toHaveText('240');
  await expect(page.getByTestId('conn')).toContainText('DEMO');
  await page.screenshot({ path: shot('02-overview-light') });

  await page.getByRole('link', { name: /Наряди-замовлення СТО/ }).click();
  await expect(page.getByTestId('range')).toContainText('Показано 1–25 з 240');
  await page.getByLabel('Стан').selectOption('Заявка');
  await expect(page.getByRole('row').nth(1)).toContainText('Заявка');
  await page.getByLabel('Стан').selectOption('');
  await page.getByLabel('Пошук').fill('ДЕМО-00137432');
  await expect(page.getByTestId('range')).toContainText('з 1');
  await page.screenshot({ path: shot('03-orders-light') });

  await page.getByRole('row').nth(1).click();
  await expect(page.getByTestId('wo-number')).toHaveText('ДЕМО-00137432');
  await expect(page.getByRole('button', { name: /Провести/ })).toBeDisabled();
  await page.screenshot({ path: shot('04-order-light') });

  await page.getByRole('button', { name: 'Перемкнути тему' }).first().click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.screenshot({ path: shot('05-order-dark') });
  await page.getByRole('link', { name: /Огляд/ }).click();
  await page.screenshot({ path: shot('06-overview-dark') });

  await page.getByRole('button', { name: 'Вийти' }).click();
  await expect(page.getByRole('heading', { name: 'Кермо' })).toBeVisible();
});
