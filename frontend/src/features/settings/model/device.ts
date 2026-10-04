export type DeviceKind = 'desktop' | 'phone' | 'tablet';

export interface DeviceInfo {
  browser: string;
  os: string;
  kind: DeviceKind;
}

const BROWSERS: [RegExp, string][] = [
  [/Edg(?:e|A|iOS)?\//, 'Edge'],
  [/OPR\/|Opera/, 'Opera'],
  [/YaBrowser/, 'Yandex Browser'],
  [/SamsungBrowser/, 'Samsung Internet'],
  [/Firefox\/|FxiOS/, 'Firefox'],
  [/Chrome\/|CriOS/, 'Chrome'],
  [/Safari\//, 'Safari'],
];

const SYSTEMS: [RegExp, string][] = [
  [/Windows/, 'Windows'],
  [/Android/, 'Android'],
  [/iPhone|iPad|iPod/, 'iOS'],
  [/Mac OS X|Macintosh/, 'macOS'],
  [/CrOS/, 'ChromeOS'],
  [/Linux|X11/, 'Linux'],
];

/** A readable name for a browser's User-Agent: "Chrome on macOS", and whether it is a phone. */
export function describeDevice(userAgent: string): DeviceInfo {
  const find = (list: [RegExp, string][]) => list.find(([re]) => re.test(userAgent))?.[1] ?? '';
  const kind: DeviceKind = /iPad|Tablet/.test(userAgent)
    ? 'tablet'
    : /Mobi|iPhone|Android/.test(userAgent)
      ? /Android/.test(userAgent) && !/Mobile/.test(userAgent)
        ? 'tablet'
        : 'phone'
      : 'desktop';
  return { browser: find(BROWSERS), os: find(SYSTEMS), kind };
}
