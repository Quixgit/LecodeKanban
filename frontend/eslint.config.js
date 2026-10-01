import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'coverage', 'node_modules'] },
  {
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    files: ['**/*.{ts,tsx}'],
    languageOptions: { ecmaVersion: 2022, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/consistent-type-imports': 'error',
      // noUncheckedIndexedAccess is on; `!` marks indices proven in-bounds by the surrounding code.
      '@typescript-eslint/no-non-null-assertion': 'off',
      // Features are only reachable through their public index.ts.
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*/*'],
              message: 'Import features only via their public API (@/features/<name>).',
            },
          ],
        },
      ],
    },
  },
  {
    // A feature may reach into its own internals with relative imports;
    // shared/ must never depend on features/, app/ or pages/.
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/features/*', '@/app/*', '@/pages/*'],
              message: 'shared/ is a leaf layer.',
            },
          ],
        },
      ],
    },
  },
  {
    // Route tables declare lazy components but are config modules, not HMR boundaries.
    files: ['**/*.test.{ts,tsx}', 'src/test/**', 'src/app/router.tsx'],
    rules: { 'react-refresh/only-export-components': 'off' },
  },
);
