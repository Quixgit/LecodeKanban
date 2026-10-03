import type { HLJSApi, Language } from 'highlight.js';

/** Minimal HCL / Terraform grammar for lowlight (highlight.js ships none). */
export function hcl(hljs: HLJSApi): Language {
  const STRING = {
    className: 'string',
    begin: '"',
    end: '"',
    contains: [
      {
        className: 'subst',
        begin: /\$\{/,
        end: /\}/,
        keywords: 'var local module data each count self path terraform',
      },
    ],
  };
  return {
    name: 'HCL',
    aliases: ['terraform', 'tf', 'tfvars'],
    keywords: {
      keyword: 'resource variable module provider data locals output terraform for in if else',
      literal: 'true false null',
      built_in:
        'var local each count self path file format join split lookup merge concat length element toset tolist tomap jsonencode jsondecode',
    },
    contains: [
      hljs.HASH_COMMENT_MODE,
      hljs.C_LINE_COMMENT_MODE,
      hljs.C_BLOCK_COMMENT_MODE,
      hljs.C_NUMBER_MODE,
      STRING,
      { className: 'attr', begin: /^\s*[A-Za-z_][\w-]*(?=\s*=)/, relevance: 0 },
      { className: 'type', begin: /<<-?[A-Z_]+/, end: /^\s*[A-Z_]+$/, relevance: 0 },
    ],
  };
}
