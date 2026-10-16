'use strict';
// Кермо: оболонка Windows-клієнта (Electron). Показує вбудований локально інтерфейс; усі дані беруться з сервера Кермо.
const { app, BrowserWindow, Menu, session, shell, ipcMain } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { resolveServerUrl } = require('./config');

const APP_ID = 'ua.kermo.erp';
const APP_TITLE = 'Кермо — ERP автодилера';

// Портативний режим: порожній файл portable.flag поруч із Kermo.exe — дані й журнали лежать у папці data.
const exeDir = path.dirname(process.execPath);
const portable = app.isPackaged && fs.existsSync(path.join(exeDir, 'portable.flag'));
if (portable) app.setPath('userData', path.join(exeDir, 'data'));
app.setAppUserModelId(APP_ID);

const clientDir = path.join(__dirname, 'client');
const clientBase = pathToFileURL(clientDir).href;
const logDir = path.join(app.getPath('userData'), 'logs');
const logFile = path.join(logDir, 'kermo.log');

function log(level, message) {
  try {
    fs.mkdirSync(logDir, { recursive: true });
    try {
      if (fs.statSync(logFile).size > 2 * 1024 * 1024) fs.renameSync(logFile, `${logFile}.1`);
    } catch { /* журналу ще немає */ }
    fs.appendFileSync(logFile, `${new Date().toISOString()} [${level}] ${message}\n`);
  } catch { /* журнал не повинен зупиняти програму */ }
}
process.on('uncaughtException', (e) => log('error', `uncaughtException: ${(e && e.stack) || e}`));
process.on('unhandledRejection', (e) => log('error', `unhandledRejection: ${(e && e.stack) || e}`));

const serverUrl = resolveServerUrl({ argv: process.argv, programData: process.env.ProgramData });
let win = null;

ipcMain.on('kermo:get-host', (event) => {
  const url = (event.senderFrame && event.senderFrame.url) || '';
  event.returnValue = url.startsWith('file:')
    ? { serverUrl, appVersion: app.getVersion(), platform: process.platform, portable, electron: process.versions.electron }
    : null;
});

function buildMenu() {
  return Menu.buildFromTemplate([
    {
      label: 'Вид',
      submenu: [
        { label: 'Оновити', accelerator: 'F5', click: () => { if (win) win.webContents.reload(); } },
        { type: 'separator' },
        { role: 'resetZoom', label: 'Масштаб 100%' },
        { role: 'zoomIn', label: 'Збільшити' },
        { role: 'zoomOut', label: 'Зменшити' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: 'Повний екран' },
      ],
    },
    {
      label: 'Довідка',
      submenu: [
        { label: 'Про систему', click: () => { if (win) win.webContents.executeJavaScript("location.hash = '#/about'").catch(() => undefined); } },
        { label: 'Відкрити папку журналів', click: () => { fs.mkdirSync(logDir, { recursive: true }); shell.openPath(logDir); } },
      ],
    },
  ]);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1024,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    title: APP_TITLE,
    backgroundColor: '#f3f5f9',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: !app.isPackaged || process.argv.includes('--devtools'),
    },
  });
  win.once('ready-to-show', () => win.show());

  const wc = win.webContents;
  // Зовнішні посилання відкриваємо в браузері, навігацію поза вбудованим інтерфейсом блокуємо.
  wc.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  wc.on('will-navigate', (event, url) => {
    if (!url.startsWith(clientBase)) {
      event.preventDefault();
      log('warn', `заблоковано навігацію: ${url}`);
    }
  });
  wc.on('did-fail-load', (_e, code, desc, url) => log('error', `did-fail-load ${code} ${desc} ${url}`));
  wc.on('render-process-gone', (_e, details) => {
    log('error', `render-process-gone: ${details.reason}`);
    if (details.reason !== 'clean-exit' && win) win.reload();
  });
  wc.on('unresponsive', () => log('warn', 'вікно не відповідає'));
  win.on('closed', () => { win = null; });

  win.loadFile(path.join(clientDir, 'index.html'));
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (!win) return;
    if (win.isMinimized()) win.restore();
    win.focus();
  });
  app.whenReady().then(() => {
    session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => callback(false));
    Menu.setApplicationMenu(buildMenu());
    log('info', `запуск v${app.getVersion()}, Electron ${process.versions.electron}, сервер: ${serverUrl || '(не задано)'}, портативний: ${portable}`);
    createWindow();
  });
  app.on('window-all-closed', () => app.quit());
}
