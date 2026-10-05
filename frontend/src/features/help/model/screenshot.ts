/** Screenshots are small images that travel inside the request. */
export const SCREENSHOT_TYPES = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const MAX_SCREENSHOT_BYTES = 2 * 1024 * 1024;

export type ScreenshotProblem = 'type' | 'size';

export function checkScreenshot(file: Pick<File, 'type' | 'size'>): ScreenshotProblem | null {
  if (!(SCREENSHOT_TYPES as readonly string[]).includes(file.type)) return 'type';
  return file.size > MAX_SCREENSHOT_BYTES ? 'size' : null;
}

/** The base64 body of a file (what the API takes), without the `data:` prefix. */
export function toBase64(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result).split(',')[1] ?? '');
    reader.readAsDataURL(file);
  });
}
