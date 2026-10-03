import type MermaidApi from 'mermaid';
import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

let mermaidPromise: Promise<typeof MermaidApi> | undefined;

/** Mermaid is large: it is only fetched when a diagram appears on a page. */
function loadMermaid() {
  mermaidPromise ??= import('mermaid').then((m) => m.default);
  return mermaidPromise;
}

/** Live preview of a ```mermaid block. Rendering is sandboxed by mermaid's "strict" security level. */
export function MermaidPreview({ code }: { code: string }) {
  const { t } = useTranslation('wikiEditor');
  const id = useId().replace(/:/g, '');
  const [svg, setSvg] = useState('');
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);

  useEffect(() => {
    const source = code.trim();
    if (!source) {
      setSvg('');
      setError(null);
      return;
    }
    const run = ++seq.current;
    const timer = window.setTimeout(async () => {
      try {
        const mermaid = await loadMermaid();
        const dark = document.documentElement.dataset.theme === 'dark';
        mermaid.initialize({
          startOnLoad: false,
          securityLevel: 'strict',
          theme: dark ? 'dark' : 'neutral',
          fontFamily: 'inherit',
        });
        const out = await mermaid.render(`m${id}-${run}`, source);
        if (run === seq.current) {
          setSvg(out.svg);
          setError(null);
        }
      } catch (e) {
        if (run === seq.current)
          setError(e instanceof Error ? e.message.split('\n')[0]! : String(e));
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [code, id]);

  return (
    <div className="lk-mermaid" contentEditable={false}>
      {error && (
        <p role="status" className="lk-mermaid-error">
          {t('mermaid.error', { message: error })}
        </p>
      )}
      {svg ? (
        <div aria-label={t('mermaid.label')} role="img" dangerouslySetInnerHTML={{ __html: svg }} />
      ) : (
        !error && <p className="lk-mermaid-empty">{t('mermaid.empty')}</p>
      )}
    </div>
  );
}
