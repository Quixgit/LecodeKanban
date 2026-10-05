import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Feature code must style through design tokens: no raw hex / rgb() colours, no arbitrary radii,
 * shadows or pixel font sizes. Brand artwork (the app shell logo, auth panel) lives in `app/`.
 * Third-party brand marks that must keep their colours are listed here, and so is the chat theme palette
 * (colours the user picks are data, not design values).
 */
const ALLOWED = new Set([
  'features/auth/components/OAuthButtons.tsx',
  'features/ui-showcase',
  'features/chat/model/theme.ts',
]);
const SRC = join(process.cwd(), 'src');
const RAW = /#[0-9a-fA-F]{3,8}\b|\brgba?\(\s*\d|\brounded-\[|\bshadow-\[|\btext-\[\d+px\]/;

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return files(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

describe('design tokens in feature code', () => {
  it('has no raw colours, radii, shadows or font sizes', () => {
    const offenders: string[] = [];
    for (const dir of ['features', 'pages']) {
      for (const file of files(join(SRC, dir))) {
        const rel = file.slice(SRC.length + 1);
        if ([...ALLOWED].some((a) => rel.startsWith(a))) continue;
        readFileSync(file, 'utf8')
          .split('\n')
          .forEach(
            (line, i) =>
              RAW.test(line) && offenders.push(`${rel}:${i + 1}: ${line.trim().slice(0, 90)}`),
          );
      }
    }
    expect(offenders).toEqual([]);
  });
});
