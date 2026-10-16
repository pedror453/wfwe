'use strict';
// Налаштування оболонки Кермо: адреса сервера з аргументу запуску або з файлу, який записує інсталятор.
const fs = require('node:fs');
const path = require('node:path');

/** Повертає адресу у вигляді http(s)://хост[:порт] або порожній рядок, якщо значення некоректне. */
function normalizeServerUrl(raw) {
  const s = String(raw === undefined || raw === null ? '' : raw).replace(/^\uFEFF/, '').trim();
  if (!s) return '';
  let u;
  try { u = new URL(s); } catch { return ''; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
  if (u.username || u.password) return '';
  return u.origin;
}

function firstLine(file) {
  try { return fs.readFileSync(file, 'utf8').split(/\r?\n/)[0]; } catch { return ''; }
}

/** Пріоритет: аргумент --server= → файл server.url в %ProgramData%\Kermo (його пише інсталятор з параметром /SERVER=). */
function resolveServerUrl({ argv = [], programData = '' } = {}) {
  const arg = argv.find((a) => typeof a === 'string' && a.startsWith('--server='));
  const fromArg = normalizeServerUrl(arg ? arg.slice('--server='.length) : '');
  if (fromArg) return fromArg;
  if (programData) return normalizeServerUrl(firstLine(path.join(programData, 'Kermo', 'server.url')));
  return '';
}

module.exports = { normalizeServerUrl, resolveServerUrl };
