import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist', 'src-tauri'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: reactHooks.configs.recommended.rules,
  },
  // Solo adapters/ puede depender de Tauri (ver TASKY_GUIDE §5.1).
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/adapters/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@tauri-apps/*'], message: 'Solo src/adapters/ puede importar Tauri.' }] }],
    },
  },
  // core/ es TypeScript puro: sin React, sin Tauri, sin capas superiores.
  {
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@tauri-apps/*', 'react', 'react-*', 'zustand'], message: 'core/ debe ser independiente de la plataforma y la UI.' },
            { group: ['../ui/*', '../state/*', '../adapters/*'], message: 'core/ no depende de otras capas.' },
          ],
        },
      ],
    },
  },
);
