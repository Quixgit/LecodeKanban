import { describe, expect, it } from 'vitest';
import { cleanTelegram, cleanWhatsApp, isEmail, suggestWorkspaceName } from './validators';

describe('onboarding validators', () => {
  it('cleans Telegram names', () => {
    expect(cleanTelegram('@maria_k')).toBe('maria_k');
    expect(cleanTelegram('https://t.me/maria_k')).toBe('maria_k');
    expect(cleanTelegram('t.me/maria_k')).toBe('maria_k');
    expect(cleanTelegram('')).toBe('');
    expect(cleanTelegram('ab')).toBeNull();
    expect(cleanTelegram('not a name')).toBeNull();
  });
  it('turns a number into the + digits form', () => {
    expect(cleanWhatsApp('+380 67 123-45-67')).toBe('+380671234567');
    expect(cleanWhatsApp('wa.me/380671234567')).toBe('+380671234567');
    expect(cleanWhatsApp('(050) 123 45 67')).toBe('+0501234567');
    expect(cleanWhatsApp('')).toBe('');
    expect(cleanWhatsApp('12')).toBeNull();
    expect(cleanWhatsApp('call me')).toBeNull();
    expect(cleanWhatsApp('1234567890123456')).toBeNull();
  });
  it('checks e-mail addresses loosely', () => {
    expect(isEmail('a@b.co')).toBe(true);
    expect(isEmail(' a@b.co ')).toBe(true);
    expect(isEmail('a@b')).toBe(false);
    expect(isEmail('a b@c.de')).toBe(false);
  });
  it('suggests a workspace name from the first name', () => {
    expect(suggestWorkspaceName('Maria Koval', (f) => `${f}'s workspace`)).toBe(
      "Maria's workspace",
    );
    expect(suggestWorkspaceName('  ', (f) => f)).toBe('');
  });
});
