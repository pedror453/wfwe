'use strict';
const { contextBridge, ipcRenderer } = require('electron');

// Налаштування від оболонки (адреса сервера, версія). Лише читання; доступу до Node у сторінці немає.
const host = ipcRenderer.sendSync('kermo:get-host');
if (host) contextBridge.exposeInMainWorld('kermoHost', Object.freeze({ ...host }));
