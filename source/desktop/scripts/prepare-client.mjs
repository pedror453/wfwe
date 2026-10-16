// Копіює зібраний веб-клієнт (source/client/dist) у source/desktop/client, звідки його бере оболонка Electron.
import { cpSync, existsSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, '../../client/dist');
const dst = resolve(here, '../client');

if (!existsSync(resolve(src, 'index.html'))) {
  console.error('Спочатку зберіть клієнт: cd source/client && npm ci && npm run build');
  process.exit(1);
}
rmSync(dst, { recursive: true, force: true });
cpSync(src, dst, { recursive: true });
console.log('Клієнт скопійовано в', dst);
