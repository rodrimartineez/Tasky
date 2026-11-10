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
    ignores: ['src/adapters/**', 'src/habits/adapters/**'],
    rules: {
      'no-restricted-imports': ['error', { patterns: [{ group: ['@tauri-apps/*'], message: 'Solo src/adapters/ (y src/habits/adapters/) pueden importar Tauri.' }] }],
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
            { group: ['**/habits/**', '**/game/**'], message: 'Proyectos no depende del modo Hábitos.' },
          ],
        },
      ],
    },
  },
  // Módulo Hábitos (HABITS_GUIDE §2): su core es TS puro y Proyectos nunca depende de él.
  {
    files: ['src/habits/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@tauri-apps/*', 'react', 'react-*', 'zustand', '@supabase/*'], message: 'habits/core/ debe ser independiente de la plataforma y la UI.' },
            { group: ['../state/*', '../ui/*', '../adapters/*', '../../state/*', '../../ui/*', '../../adapters/*'], message: 'habits/core/ no depende de otras capas.' },
          ],
        },
      ],
    },
  },
  // (Las reglas se sustituyen, no se suman: cada bloque repite las restricciones que le aplican.)
  {
    files: ['src/state/**/*.ts', 'src/mcp/**/*.ts', 'src/ui/projects/**', 'src/ui/tasks/**', 'src/ui/ideas/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['@tauri-apps/*'], message: 'Solo src/adapters/ (y src/habits/adapters/) pueden importar Tauri.' },
            { group: ['**/habits/**', '**/game/**'], message: 'Proyectos no depende del modo Hábitos.' },
          ],
        },
      ],
    },
  },
);
