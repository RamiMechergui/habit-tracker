import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Generated/native code — never lint build output or Capacitor artifacts
    'android',
    '**/build/**',
    // Legacy static files / public assets copied verbatim into dist
    'public',
    '*.config.js',
    'vite.config.js',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      // `_`-prefixed vars are intentionally ignored (e.g. catch params)
      'no-unused-vars': ['error', {
        varsIgnorePattern: '^[A-Z_]',
        argsIgnorePattern: '^[A-Z_]',
        // Legacy codebase intentionally ignores errors in many catch blocks
        caughtErrors: 'none',
      }],
      // Empty catch blocks (e.g. best-effort localStorage writes) are allowed
      'no-empty': ['error', { allowEmptyCatch: true }],
      // Legacy patterns — these newer React Compiler checks flag intentional
      // long-standing code (edit-form state syncing, manual memoization).
      // Kept as warnings for visibility instead of blocking the build.
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/preserve-manual-memoization': 'warn',
      // Dev-HMR nicety, not a correctness rule
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // One-off icon/asset generation scripts run under Node, not the browser
    files: ['generate-icons.js', 'circle-favicon.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
