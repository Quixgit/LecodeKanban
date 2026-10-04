/** The time zones the browser knows, for the suggestions under the time zone field. */
export const TIMEZONES: readonly string[] = (() => {
  try {
    return (Intl as unknown as { supportedValuesOf(key: string): string[] }).supportedValuesOf(
      'timeZone',
    );
  } catch {
    return [];
  }
})();

/** The IANA name of this device's time zone, or an empty string when it cannot be told. */
export function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? '';
  } catch {
    return '';
  }
}
