import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import prettierConfig from 'eslint-config-prettier';
import jsxAlly from 'eslint-plugin-jsx-a11y';
import prettierRecommended from 'eslint-plugin-prettier/recommended';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import simpleImportSort from 'eslint-plugin-simple-import-sort';
import unicorn from 'eslint-plugin-unicorn';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommendedTypeChecked,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
      prettierConfig,
      prettierRecommended, 
      unicorn.configs.recommended,
      jsxAlly.flatConfigs.recommended,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        projectService: true,
      },
    },
    plugins: {
      'simple-import-sort': simpleImportSort,
    },
    rules: {
      'arrow-body-style': ['error', 'as-needed'],

      'unicorn/no-array-reduce': 'off',
      'unicorn/no-await-expression-member': 'off',
      'unicorn/no-null': 'off',
      'unicorn/prevent-abbreviations': 'off',
      'unicorn/prefer-spread': 'off',
      'unicorn/consistent-function-scoping': 'off',
      'unicorn/no-abusive-eslint-disable': 'off',
      'unicorn/prefer-global-this': 'off',
      'unicorn/prefer-module': 'off',
      'unicorn/no-anonymous-default-export': 'off',
      'unicorn/prefer-add-event-listener': 'off',
      'unicorn/number-literal-case': 'off',
      'unicorn/relative-url-style': 'off',
      'unicorn/prefer-top-level-await': 'off',

      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',

      'jsx-a11y/click-events-have-key-events': 'off',
      'jsx-a11y/no-static-element-interactions': 'off',
      'jsx-a11y/mouse-events-have-key-events': 'off',
      'jsx-a11y/alt-text': 'off',

      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/prefer-destructuring': 'off',
      '@typescript-eslint/no-magic-numbers': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/strict-boolean-expressions': 'off',
      '@typescript-eslint/no-unnecessary-condition': 'off',
      '@typescript-eslint/method-signature-style': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/non-nullable-type-assertion-style': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/consistent-type-assertions': 'off',
      '@typescript-eslint/prefer-nullish-coalescing': 'off',
      '@typescript-eslint/no-invalid-void-type': 'off',
      '@typescript-eslint/prefer-readonly-parameter-types': 'off',
      '@typescript-eslint/prefer-promise-reject-errors': 'off', 
      '@typescript-eslint/triple-slash-reference': 'off',
      '@typescript-eslint/init-declarations': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      '@typescript-eslint/no-floating-promises': [
        'error',
        {
          ignoreVoid: true,
        },
      ],
    },
  },
]);
