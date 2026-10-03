import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { CALLOUT_TYPES, type CalloutType } from '../extensions/Callout';

const ICONS: Record<CalloutType, LucideIcon> = {
  info: Info,
  warning: TriangleAlert,
  danger: CircleAlert,
  success: CircleCheck,
};

/** Callout: a tinted block with an outline icon; editors can switch its type. */
export function CalloutView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation('wikiEditor');
  const type = (node.attrs.type as CalloutType) ?? 'info';
  const Icon = ICONS[type];
  return (
    <NodeViewWrapper className="lk-callout" data-callout={type}>
      <div className="lk-callout-icon" contentEditable={false}>
        <Icon aria-hidden />
        {editor.isEditable && (
          <select
            aria-label={t('callout.type')}
            value={type}
            onChange={(e) => updateAttributes({ type: e.target.value })}
          >
            {CALLOUT_TYPES.map((c) => (
              <option key={c} value={c}>
                {t(`callout.${c}`)}
              </option>
            ))}
          </select>
        )}
      </div>
      <NodeViewContent className="lk-callout-body" />
    </NodeViewWrapper>
  );
}
