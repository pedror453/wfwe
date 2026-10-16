import { describe, expect, it } from 'vitest';
import { defaultServer, FALLBACK_SERVER, normalizeServerInput } from './server-url';

describe('normalizeServerInput', () => {
  it('додає http:// і прибирає кінцеві слеші', () => {
    expect(normalizeServerInput('srv:8480')).toBe('http://srv:8480');
    expect(normalizeServerInput('  https://erp.local// ')).toBe('https://erp.local');
    expect(normalizeServerInput('192.168.0.10:8480/')).toBe('http://192.168.0.10:8480');
    expect(normalizeServerInput('   ')).toBe('');
  });
});

describe('defaultServer', () => {
  it('віддає перевагу адресі з налаштувань програми', () => {
    expect(defaultServer({ protocol: 'file:', origin: 'null', port: '' }, { serverUrl: 'http://s:8480' })).toBe('http://s:8480');
  });
  it('у браузері бере сервер, що віддав клієнта', () => {
    expect(defaultServer({ protocol: 'http:', origin: 'http://lr:8480', port: '8480' }, null)).toBe('http://lr:8480');
  });
  it('у режимі розробки та без налаштувань повертає локальний шлюз', () => {
    expect(defaultServer({ protocol: 'http:', origin: 'http://localhost:5173', port: '5173' }, null)).toBe(FALLBACK_SERVER);
    expect(defaultServer({ protocol: 'file:', origin: 'null', port: '' }, { serverUrl: '' })).toBe(FALLBACK_SERVER);
  });
});
