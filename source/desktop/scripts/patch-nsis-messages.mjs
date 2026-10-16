// Додає українські переклади службових повідомлень інсталятора electron-builder (у шаблонах пакета їх немає).
// Ідемпотентно; запускається перед кожною збіркою інсталятора (npm run dist).
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const templates = join(dirname(require.resolve('app-builder-lib/package.json')), 'templates', 'nsis');

const UK = {
  'messages.yml': {
    win7Required: 'Потрібна Windows 7 або новіша',
    x64WinRequired: 'Потрібна 64-розрядна Windows',
    appRunning: 'Програму ${PRODUCT_NAME} запущено.\nНатисніть «OK», щоб закрити її.\nЯкщо вона не закриється, закрийте її вручну.',
    appCannotBeClosed: 'Не вдалося закрити ${PRODUCT_NAME}. \nЗакрийте програму вручну та натисніть «Повторити», щоб продовжити.',
    installing: 'Встановлення. Будь ласка, зачекайте...',
    areYouSureToUninstall: 'Ви впевнені, що хочете видалити ${PRODUCT_NAME}?',
    decompressionFailed: 'Не вдалося розпакувати файли. Спробуйте запустити інсталятор ще раз.',
    uninstallFailed: 'Не вдалося видалити файли попередньої версії. Спробуйте запустити інсталятор ще раз.',
    appClosing: 'Закриття запущеної програми ${PRODUCT_NAME}...',
  },
  'assistedMessages.yml': {
    chooseInstallationOptions: 'Параметри встановлення',
    chooseUninstallationOptions: 'Параметри видалення',
    whichInstallationShouldBeRemoved: 'Яке встановлення потрібно видалити?',
    whoShouldThisApplicationBeInstalledFor: 'Для кого встановити цю програму?',
    selectUserMode: 'Оберіть, чи робити програму доступною всім користувачам комп’ютера, чи лише вам',
    whichInstallationRemove: 'Програму встановлено і для всіх користувачів комп’ютера, і для поточного користувача.\nЯке встановлення видалити?',
    freshInstallForAll: 'Нове встановлення для всіх користувачів (буде запит облікових даних адміністратора).',
    freshInstallForCurrent: 'Нове встановлення лише для поточного користувача.',
    onlyForMe: 'Лише для &мене',
    forAll: 'Для всіх, хто користується цим комп’ютером (&усі користувачі)',
    loginWithAdminAccount: 'Для продовження увійдіть під обліковим записом, що входить до групи адміністраторів...',
    perUserInstallExists: 'Уже є встановлення для поточного користувача.',
    perUserInstall: 'Є встановлення для поточного користувача.',
    perMachineInstallExists: 'Уже є встановлення для всіх користувачів комп’ютера.',
    perMachineInstall: 'Є встановлення для всіх користувачів комп’ютера.',
    reinstallUpgrade: 'Буде виконано перевстановлення або оновлення.',
    uninstall: 'Буде виконано видалення.',
  },
};

const yamlString = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n')}"`;

for (const [file, map] of Object.entries(UK)) {
  const path = join(templates, file);
  const lines = readFileSync(path, 'utf8').split(/\r?\n/);
  const out = [];
  const seen = new Set();
  let key = null;
  let added = 0;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const m = /^([A-Za-z0-9]+):\s*$/.exec(line);
    if (m) { key = m[1]; seen.add(key); }
    out.push(line);
    if (key && map[key] && /^ {2}en:/.test(line)) {
      let has = false;
      for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) if (/^ {2}uk:/.test(lines[j])) has = true;
      if (!has) { out.push(`  uk: ${yamlString(map[key])}`); added++; }
    }
  }
  writeFileSync(path, out.join('\n'), 'utf8');
  const missing = Object.keys(map).filter((k) => !seen.has(k));
  console.log(`${file}: додано перекладів ${added}${missing.length ? `; немає ключів у шаблоні: ${missing.join(', ')}` : ''}`);
}
