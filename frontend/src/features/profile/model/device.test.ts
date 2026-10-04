import { describe, expect, it } from 'vitest';
import { describeDevice } from './device';

const CHROME_MAC =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const SAFARI_IPHONE =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const EDGE_WIN =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36 Edg/126.0.0.0';
const FIREFOX_LINUX = 'Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0';
const CHROME_ANDROID_TABLET =
  'Mozilla/5.0 (Linux; Android 13; SM-X700) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

describe('describeDevice', () => {
  it('names browsers and systems', () => {
    expect(describeDevice(CHROME_MAC)).toEqual({ browser: 'Chrome', os: 'macOS', kind: 'desktop' });
    expect(describeDevice(EDGE_WIN)).toEqual({ browser: 'Edge', os: 'Windows', kind: 'desktop' });
    expect(describeDevice(FIREFOX_LINUX)).toEqual({
      browser: 'Firefox',
      os: 'Linux',
      kind: 'desktop',
    });
  });

  it('tells phones from tablets', () => {
    expect(describeDevice(SAFARI_IPHONE)).toEqual({ browser: 'Safari', os: 'iOS', kind: 'phone' });
    expect(describeDevice(CHROME_ANDROID_TABLET).kind).toBe('tablet');
  });

  it('copes with nothing useful', () => {
    expect(describeDevice('')).toEqual({ browser: '', os: '', kind: 'desktop' });
    expect(describeDevice('test')).toEqual({ browser: '', os: '', kind: 'desktop' });
  });
});
