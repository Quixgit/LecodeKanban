/** The centred square to cut out of an image of the given size. */
export function squareCrop(width: number, height: number): { x: number; y: number; side: number } {
  const side = Math.min(width, height);
  return { x: Math.round((width - side) / 2), y: Math.round((height - side) / 2), side };
}

export const ACCEPTED_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const;
/** Pictures are shrunk before they are sent, so even a large photo is accepted. */
export const MAX_SOURCE_BYTES = 12 * 1024 * 1024;

export type PictureProblem = 'type' | 'size';

export function checkPicture(file: { type: string; size: number }): PictureProblem | null {
  if (!(ACCEPTED_TYPES as readonly string[]).includes(file.type)) return 'type';
  if (file.size > MAX_SOURCE_BYTES) return 'size';
  return null;
}

/** Cuts the centred square out of a picture and scales it to `size` pixels, as a PNG. */
export async function squarePng(file: Blob, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  try {
    const { x, y, side } = squareCrop(bitmap.width, bitmap.height);
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas unavailable');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, x, y, side, side, 0, 0, size, size);
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png'),
    );
  } finally {
    bitmap.close();
  }
}
