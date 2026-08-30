import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],

      // eslint-plugin-react-hooks v7 added structural rules that flag
      // long-standing patterns in this codebase — refs written during render
      // and setState called synchronously inside effects, mostly in the admin
      // screens. They are worth fixing, but each one is a behavioural change to
      // a screen with no test coverage, so they stay visible as warnings and
      // get worked through deliberately instead of blocking every build.
      'react-hooks/refs': 'warn',
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/immutability': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',

      // Fast-refresh hygiene, not correctness. The route module exports lazy
      // route objects and the context modules export their hooks alongside the
      // provider, both of which are deliberate.
      'react-refresh/only-export-components': 'warn',
    },
  },
])
