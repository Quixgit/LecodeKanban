// Generates docs/API.md from api/openapi.yaml (run via `make gen`).
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const spec = parse(readFileSync(resolve(root, 'api/openapi.yaml'), 'utf8'));
const ref = (r) => r?.$ref?.split('/').pop();

const lines = [
  `# ${spec.info.title} — v${spec.info.version}`,
  '',
  '> Generated from `api/openapi.yaml` by `make gen`. Do not edit by hand.',
  '',
  spec.info.description.trim(),
  '',
  `Base URL: \`${spec.servers[0].url}\``,
  '',
];

const byTag = new Map();
for (const [path, item] of Object.entries(spec.paths)) {
  for (const method of ['get', 'post', 'put', 'patch', 'delete']) {
    const op = item[method];
    if (!op) continue;
    const tag = op.tags?.[0] ?? 'other';
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push({ path, method, op });
  }
}

for (const [tag, ops] of byTag) {
  lines.push(
    `## ${tag}`,
    '',
    '| Method | Path | Auth | Request | Responses | Summary |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const { path, method, op } of ops) {
    const auth = Array.isArray(op.security) && op.security.length === 0 ? 'public' : 'session';
    const body = ref(op.requestBody?.content?.['application/json']?.schema) ?? '';
    const responses = Object.entries(op.responses)
      .map(([code, r]) => `${code}${ref(r) ? ` ${ref(r)}` : ''}`)
      .join(', ');
    lines.push(
      `| ${method.toUpperCase()} | \`${path}\` | ${auth} | ${body} | ${responses} | ${op.summary ?? ''} |`,
    );
  }
  lines.push('');
}

lines.push('## Schemas', '');
for (const [name, schema] of Object.entries(spec.components.schemas)) {
  if (schema.enum) {
    lines.push(`- **${name}**: ${schema.enum.map((v) => `\`${v}\``).join(' | ')}`);
    continue;
  }
  const req = new Set(schema.required ?? []);
  const props = Object.entries(schema.properties ?? {}).map(
    ([p, s]) =>
      `\`${p}${req.has(p) ? '' : '?'}\`: ${ref(s) ?? s.type ?? 'object'}${s.nullable ? ' \\| null' : ''}`,
  );
  lines.push(`- **${name}** — ${props.join(', ')}`);
}

writeFileSync(resolve(root, 'docs/API.md'), lines.join('\n') + '\n');
console.log('docs/API.md written');
