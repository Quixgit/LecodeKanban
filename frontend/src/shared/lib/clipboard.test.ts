import { afterEach, describe, expect, it, vi } from 'vitest';
import { copyText } from './clipboard';

const original = { clipboard: navigator.clipboard, exec: document.execCommand };

function setSecure(value: boolean) {
  Object.defineProperty(window, 'isSecureContext', { value, configurable: true });
}
function setClipboard(value: unknown) {
  Object.defineProperty(navigator, 'clipboard', { value, configurable: true });
}

afterEach(() => {
  setSecure(true);
  setClipboard(original.clipboard);
  document.execCommand = original.exec;
  document.body.innerHTML = '';
});

describe('copyText', () => {
  it('uses the clipboard API on a secure page', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    setSecure(true);
    setClipboard({ writeText });
    expect(await copyText('hello')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('hello');
  });

  it('falls back to the copy command on a plain http page, where the API does not exist', async () => {
    setSecure(false);
    setClipboard(undefined);
    let copied = '';
    document.execCommand = vi.fn((cmd: string) => {
      copied = (document.activeElement as HTMLTextAreaElement).value;
      return cmd === 'copy';
    });
    expect(await copyText('https://x/invite/abc')).toBe(true);
    expect(copied).toBe('https://x/invite/abc');
    expect(document.querySelector('textarea')).toBeNull();
  });

  it('falls back when the API refuses', async () => {
    setSecure(true);
    setClipboard({ writeText: vi.fn().mockRejectedValue(new Error('denied')) });
    document.execCommand = vi.fn(() => true);
    expect(await copyText('x')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
  });

  it('says so when nothing works', async () => {
    setSecure(false);
    setClipboard(undefined);
    document.execCommand = vi.fn(() => false);
    expect(await copyText('x')).toBe(false);
  });

  it('puts the hidden field inside an open dialog so its focus trap keeps it', async () => {
    setSecure(false);
    setClipboard(undefined);
    document.body.innerHTML = '<div role="dialog"><button id="b">Copy</button></div>';
    const button = document.getElementById('b')!;
    button.focus();
    let parent: string | null = null;
    document.execCommand = vi.fn(() => {
      parent = (document.activeElement as HTMLElement).parentElement?.getAttribute('role') ?? null;
      return true;
    });
    await copyText('x');
    expect(parent).toBe('dialog');
    expect(document.activeElement).toBe(button);
  });
});
