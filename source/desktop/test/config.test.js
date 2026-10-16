'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { normalizeServerUrl, resolveServerUrl } = require('../config');

function programData(content) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kermo-pd-'));
  fs.mkdirSync(path.join(dir, 'Kermo'));
  if (content !== undefined) fs.writeFileSync(path.join(dir, 'Kermo', 'server.url'), content);
  return dir;
}

test('normalizeServerUrl приймає лише http/https і прибирає шлях', () => {
  assert.equal(normalizeServerUrl('http://srv:8480/'), 'http://srv:8480');
  assert.equal(normalizeServerUrl(' https://erp.local/app?x=1 '), 'https://erp.local');
  assert.equal(normalizeServerUrl('ftp://srv'), '');
  assert.equal(normalizeServerUrl('file:///c:/x'), '');
  assert.equal(normalizeServerUrl('javascript:alert(1)'), '');
  assert.equal(normalizeServerUrl('srv:8480'), '');
  assert.equal(normalizeServerUrl('http://user:pw@srv'), '');
  assert.equal(normalizeServerUrl(''), '');
  assert.equal(normalizeServerUrl(undefined), '');
});

test('resolveServerUrl: аргумент --server= важливіший за файл інсталятора', () => {
  const pd = programData('http://file-host:8480\r\n');
  assert.equal(resolveServerUrl({ argv: ['Kermo.exe', '--server=http://arg-host:9000'], programData: pd }), 'http://arg-host:9000');
});

test('resolveServerUrl: читає перший рядок server.url, навіть з BOM', () => {
  const pd = programData('\uFEFFhttp://file-host:8480\r\nдругий рядок');
  assert.equal(resolveServerUrl({ argv: [], programData: pd }), 'http://file-host:8480');
});

test('resolveServerUrl: некоректний аргумент ігнорується, береться файл', () => {
  const pd = programData('http://file-host:8480');
  assert.equal(resolveServerUrl({ argv: ['--server=javascript:1'], programData: pd }), 'http://file-host:8480');
});

test('resolveServerUrl: порожньо, якщо нічого не задано', () => {
  assert.equal(resolveServerUrl({ argv: [], programData: programData() }), '');
  assert.equal(resolveServerUrl({}), '');
});
