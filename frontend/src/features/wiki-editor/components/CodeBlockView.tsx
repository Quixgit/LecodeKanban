import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { Check, Copy } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '@/shared/ui';
import { CODE_LANGUAGES } from '../extensions/lowlight';
import { MermaidPreview } from './MermaidPreview';

/** Code block with a language picker, a copy button and, for mermaid, a live diagram. */
export function CodeBlockView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation('wikiEditor');
  const [copied, setCopied] = useState(false);
  const language = (node.attrs.language as string | null) ?? '';
  const known = CODE_LANGUAGES.some((l) => l.value === language);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(node.textContent);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error(t('code.copyFailed'));
    }
  };

  return (
    <NodeViewWrapper className="lk-codeblock">
      <div className="lk-codeblock-bar" contentEditable={false}>
        <select
          aria-label={t('code.language')}
          value={language}
          disabled={!editor.isEditable}
          onChange={(e) => updateAttributes({ language: e.target.value || null })}
        >
          <option value="">{t('code.plain')}</option>
          {!known && language && <option value={language}>{language}</option>}
          {CODE_LANGUAGES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
        <button type="button" onClick={copy} aria-label={t('code.copy')}>
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
          <span>{copied ? t('code.copied') : t('code.copy')}</span>
        </button>
      </div>
      <pre>
        <NodeViewContent<'code'>
          as="code"
          className={language ? `language-${language}` : undefined}
        />
      </pre>
      {language === 'mermaid' && <MermaidPreview code={node.textContent} />}
    </NodeViewWrapper>
  );
}
