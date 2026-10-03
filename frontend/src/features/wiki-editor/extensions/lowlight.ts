import bash from 'highlight.js/lib/languages/bash';
import css from 'highlight.js/lib/languages/css';
import diff from 'highlight.js/lib/languages/diff';
import dockerfile from 'highlight.js/lib/languages/dockerfile';
import go from 'highlight.js/lib/languages/go';
import ini from 'highlight.js/lib/languages/ini';
import java from 'highlight.js/lib/languages/java';
import javascript from 'highlight.js/lib/languages/javascript';
import json from 'highlight.js/lib/languages/json';
import markdown from 'highlight.js/lib/languages/markdown';
import nginx from 'highlight.js/lib/languages/nginx';
import python from 'highlight.js/lib/languages/python';
import rust from 'highlight.js/lib/languages/rust';
import sql from 'highlight.js/lib/languages/sql';
import typescript from 'highlight.js/lib/languages/typescript';
import xml from 'highlight.js/lib/languages/xml';
import yaml from 'highlight.js/lib/languages/yaml';
import { createLowlight } from 'lowlight';
import { hcl } from './hcl';

export const lowlight = createLowlight();
lowlight.register({
  bash,
  css,
  diff,
  dockerfile,
  go,
  hcl,
  ini,
  java,
  javascript,
  json,
  markdown,
  nginx,
  python,
  rust,
  sql,
  typescript,
  xml,
  yaml,
});
lowlight.registerAlias({
  bash: ['sh', 'shell', 'zsh'],
  dockerfile: ['docker'],
  go: ['golang'],
  javascript: ['js', 'jsx'],
  typescript: ['ts', 'tsx'],
  yaml: ['yml'],
  xml: ['html', 'svg'],
  ini: ['toml'],
  markdown: ['md'],
  hcl: ['terraform', 'tf'],
});

/** Languages offered in the picker (key → label); "mermaid" renders a live diagram. */
export const CODE_LANGUAGES: { value: string; label: string }[] = [
  { value: 'bash', label: 'Bash' },
  { value: 'yaml', label: 'YAML' },
  { value: 'go', label: 'Go' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'hcl', label: 'HCL / Terraform' },
  { value: 'dockerfile', label: 'Dockerfile' },
  { value: 'sql', label: 'SQL' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'rust', label: 'Rust' },
  { value: 'nginx', label: 'Nginx' },
  { value: 'ini', label: 'INI / TOML' },
  { value: 'xml', label: 'HTML / XML' },
  { value: 'css', label: 'CSS' },
  { value: 'diff', label: 'Diff' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'mermaid', label: 'Mermaid' },
];
