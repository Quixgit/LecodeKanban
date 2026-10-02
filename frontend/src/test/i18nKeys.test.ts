import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Static guard: every literal `t('key')` in the source must exist in both languages. (Keys built
 * from template literals are covered by the locale parity test, not here.)
 */
const SRC = join(process.cwd(), 'src');
const LOCALES = join(process.cwd(), 'public', 'locales');
const LANGS = ['en', 'uk'] as const;

type Tree = { [k: string]: string | Tree };
const load = (lang: string, ns: string): Tree | undefined => {
  try {
    return JSON.parse(readFileSync(join(LOCALES, lang, `${ns}.json`), 'utf8')) as Tree;
  } catch {
    return undefined;
  }
};

function has(tree: Tree | undefined, key: string): boolean {
  let cur: string | Tree | undefined = tree;
  for (const part of key.split('.')) {
    if (typeof cur !== 'object' || cur === undefined) return false;
    if (part in cur) cur = cur[part];
    else if (Object.keys(cur).some((k) => k.startsWith(`${part}_`)))
      return true; // plural forms
    else return false;
  }
  return true;
}

function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === 'ui-showcase' ? [] : sources(p);
    return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

describe('translation keys used in code', () => {
  it('exist in every language', () => {
    const missing: string[] = [];
    for (const file of sources(SRC)) {
      const text = readFileSync(file, 'utf8');
      const hook = /useTranslation\(\s*(\[[^\]]*\]|'[^']*')?/.exec(text)?.[1];
      const defaults = hook ? [...hook.matchAll(/'([a-z]+)'/g)].map((m) => m[1]!) : ['common'];
      for (const m of text.matchAll(/\bt\(\s*'([^'$]+)'/g)) {
        const raw = m[1]!;
        const [ns, key] = raw.includes(':')
          ? (raw.split(':', 2) as [string, string])
          : [undefined, raw];
        const candidates = ns ? [ns] : defaults;
        for (const lang of LANGS) {
          if (!candidates.some((c) => has(load(lang, c), key))) {
            missing.push(`${lang}: ${raw} (${file.slice(SRC.length + 1)})`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
