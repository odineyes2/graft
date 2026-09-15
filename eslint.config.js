// @ts-check
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierConfig from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: ['dist/**', 'node_modules/**', 'coverage/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'phaser',
              message: 'src/core는 순수 TypeScript여야 합니다. Phaser를 import할 수 없습니다.',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'src/core는 window를 참조할 수 없습니다.' },
        { name: 'document', message: 'src/core는 document를 참조할 수 없습니다.' },
        { name: 'localStorage', message: 'src/core는 localStorage를 참조할 수 없습니다.' },
      ],
    },
  },
  prettierConfig,
);
