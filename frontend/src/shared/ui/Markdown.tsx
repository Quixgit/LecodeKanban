import { memo } from 'react';
import ReactMarkdown, { defaultUrlTransform, type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '../lib/cn';
import { MENTION_RE } from '../lib/mentions';

/** @channel, @here and @everyone address the whole conversation. */
const BROADCAST_RE = /(^|[\s(])@(channel|here|everyone)\b/g;

/** Mentions are stored as @[Name](user-id); render them through a private link scheme. */
function withMentionLinks(src: string) {
  return src
    .replace(MENTION_RE, (_m, name: string, id: string) => `[@${name}](mention:${id})`)
    .replace(BROADCAST_RE, (_m, lead: string, word: string) => `${lead}[@${word}](mention:all)`);
}

const urlTransform = (url: string) => (url.startsWith('mention:') ? url : defaultUrlTransform(url));

const components: Components = {
  a: ({ href, children }) =>
    href?.startsWith('mention:') ? (
      <span className="rounded-md bg-primary-soft px-1 font-medium text-primary-ink">
        {children}
      </span>
    ) : (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-primary-ink underline underline-offset-2"
      >
        {children}
      </a>
    ),
  // External images could track readers: show them as links instead of loading them.
  img: ({ src, alt }) =>
    typeof src === 'string' ? (
      <a
        href={src}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="text-primary-ink underline"
      >
        {alt || src}
      </a>
    ) : null,
};

/** Read-only Markdown (GFM) for descriptions and comments. Raw HTML is never rendered. */
export const Markdown = memo(function Markdown({
  source,
  className,
}: {
  source: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'break-words text-base leading-relaxed text-text',
        '[&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-1.5 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-5',
        '[&_h1]:mt-3 [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:text-md [&_h2]:font-semibold [&_h3]:mt-2 [&_h3]:font-semibold',
        '[&_code]:rounded [&_code]:bg-surface-muted [&_code]:px-1 [&_code]:font-mono [&_code]:text-sm',
        '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-surface-muted [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0',
        '[&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_blockquote]:text-text-secondary',
        '[&_table]:my-2 [&_table]:w-full [&_table]:text-sm [&_td]:border [&_td]:border-border-subtle [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-border-subtle [&_th]:px-2 [&_th]:py-1 [&_th]:text-left',
        '[&_input[type=checkbox]]:mr-1.5 [&_input[type=checkbox]]:align-middle',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={components}
        urlTransform={urlTransform}
        skipHtml
      >
        {withMentionLinks(source)}
      </ReactMarkdown>
    </div>
  );
});
