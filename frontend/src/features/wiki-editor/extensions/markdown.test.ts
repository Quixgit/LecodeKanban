// @vitest-environment jsdom
import { Editor } from '@tiptap/core';
import { describe, expect, it } from 'vitest';
import { buildExtensions } from './index';

const make = (content: string | object, contentType?: 'markdown') =>
  new Editor({
    element: document.createElement('div'),
    extensions: buildExtensions({ placeholder: () => '', getSlashItems: () => [] }),
    content,
    contentType,
  });

describe('Markdown round trip through the editor schema', () => {
  it('parses Markdown into blocks', () => {
    const ed = make(
      '# Title\n\nText with **bold** and `code`.\n\n- a\n- b\n\n- [ ] todo\n- [x] done\n\n> quote\n\n```bash\nls -la\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n',
      'markdown',
    );
    const types = ed.getJSON().content!.map((n) => n.type);
    expect(types).toEqual(
      expect.arrayContaining([
        'heading',
        'paragraph',
        'bulletList',
        'taskList',
        'blockquote',
        'codeBlock',
        'table',
      ]),
    );
    expect(ed.getJSON().content!.find((n) => n.type === 'codeBlock')!.attrs!.language).toBe('bash');
    ed.destroy();
  });

  it('serialises headings, lists, tasks, code, tables and callouts back to Markdown', () => {
    const ed = make(
      '# Title\n\n- a\n- b\n\n1. x\n2. y\n\n- [ ] todo\n- [x] done\n\n```bash\nls\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n\n> [!WARNING]\n> careful\n',
      'markdown',
    );
    const md = ed.getMarkdown();
    expect(md).toContain('# Title');
    expect(md).toMatch(/- a\n- b/);
    expect(md).toMatch(/1\. x\n2\. y/);
    expect(md).toContain('- [ ] todo');
    expect(md).toContain('- [x] done');
    expect(md).toContain('```bash\nls\n```');
    expect(md).toMatch(/\| a\s*\| b\s*\|/);
    expect(md).toContain('> [!WARNING]\n> careful');
    // And the callout survives the trip back into the schema.
    const types = make(md, 'markdown')
      .getJSON()
      .content!.map((n) => n.type);
    expect(types).toContain('callout');
    ed.destroy();
  });

  it('every document the editor produces uses only attributes the server allows', () => {
    const ed = make(
      '# H\n\ntext [x](https://example.com)\n\n- a\n\n- [ ] t\n\n```go\nx\n```\n\n| a | b |\n| --- | --- |\n| 1 | 2 |\n',
      'markdown',
    );
    const allowed: Record<string, string[]> = {
      doc: [],
      paragraph: ['textAlign'],
      heading: ['level', 'textAlign'],
      text: [],
      hardBreak: [],
      horizontalRule: [],
      blockquote: [],
      bulletList: [],
      orderedList: ['start', 'type'],
      listItem: [],
      taskList: [],
      taskItem: ['checked'],
      codeBlock: ['language'],
      callout: ['type'],
      details: ['open'],
      detailsSummary: [],
      detailsContent: [],
      table: [],
      tableRow: [],
      tableHeader: ['colspan', 'rowspan', 'colwidth', 'align'],
      tableCell: ['colspan', 'rowspan', 'colwidth', 'align'],
      image: ['src', 'alt', 'title', 'width', 'height'],
      youtube: ['src', 'start', 'width', 'height'],
      inlineMath: ['latex'],
      blockMath: ['latex'],
    };
    const bad: string[] = [];
    const walk = (n: { type?: string; attrs?: Record<string, unknown>; content?: unknown[] }) => {
      const spec = allowed[n.type ?? ''];
      if (!spec) bad.push(`node ${n.type}`);
      for (const k of Object.keys(n.attrs ?? {}))
        if (spec && !spec.includes(k)) bad.push(`${n.type}.${k}`);
      (n.content ?? []).forEach((c) => walk(c as never));
    };
    walk(ed.getJSON());
    expect(bad).toEqual([]);
    ed.destroy();
  });
});
