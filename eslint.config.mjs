import typescriptPlugin from '@typescript-eslint/eslint-plugin';
import typescriptParser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import prettierPlugin from 'eslint-plugin-prettier';

export default [
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: typescriptParser,
    },
    plugins: {
      '@typescript-eslint': typescriptPlugin,
      import: importPlugin,
      prettier: prettierPlugin,
    },
    rules: {
      // General ESLint rules
      'no-console': 'warn', // Warn on console usage
      'no-debugger': 'error', // Disallow debugger
      'eqeqeq': ['error', 'always'], // Enforce strict equality

      // TypeScript-specific rules
      '@typescript-eslint/no-explicit-any': 'warn', // Warn against using `any` type
      '@typescript-eslint/no-empty-function': 'off', // Allow empty functions

      // Import plugin rules
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index', 'object', 'type'],
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],
      // Temporary disabled
      'import/no-unresolved': 'off', // Ensure imports can be resolved
      'import/newline-after-import': 'error', // Enforce newline after import statements
      'prettier/prettier': ['error', {
        endOfLine: 'lf' // Use LF line endings consistently
      }], // Ensure code is formatted according to Prettier rules
    },
  },
  {
    files: ['**/*.test.ts', '**/test/**/*.ts'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off', // Disable `any` type rule for tests
    },
  },
];