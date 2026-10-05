/** The same rules as the server, so a slip is caught before the request. */

const TELEGRAM = /^[A-Za-z0-9_]{5,32}$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** "@name", "t.me/name" or "https://t.me/name" → "name"; null when it cannot be a Telegram name. Empty is fine. */
export function cleanTelegram(input: string): string | null {
  let s = input.trim();
  if (!s) return '';
  s = s
    .replace(/^https?:\/\//, '')
    .replace(/^(t|telegram)\.me\//, '')
    .replace(/^@/, '');
  return TELEGRAM.test(s) ? s : null;
}

/** A number in any common spelling, or a wa.me link → "+380671234567"; null when it is not one. Empty is fine. */
export function cleanWhatsApp(input: string): string | null {
  let s = input.trim();
  if (!s) return '';
  s = s
    .replace(/^https?:\/\//, '')
    .replace(/^wa\.me\//, '')
    .replace(/^api\.whatsapp\.com\/send\?phone=/, '');
  if (/[^0-9+\s\-().]/.test(s)) return null;
  const digits = s.replace(/\D/g, '');
  return /^[0-9]{8,15}$/.test(digits) ? `+${digits}` : null;
}

export function isEmail(input: string): boolean {
  return EMAIL.test(input.trim());
}

/** Works out a first workspace name from a person's name: "Maria Koval" → "Maria's workspace". */
export function suggestWorkspaceName(person: string, template: (first: string) => string): string {
  const first = person.trim().split(/\s+/)[0] ?? '';
  return first ? template(first) : '';
}
