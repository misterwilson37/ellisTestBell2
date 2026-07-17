/**
 * Minimal lint: no-undef only. This single rule caught 14 latent
 * ReferenceErrors during the v5.72.0 refactor (calls to functions that were
 * never defined, silently crashing rarely-used features). Run it after any
 * change to src/js/ or bell-engine.js:
 *
 *     cd build && npm run lint
 */
import globals from 'globals';

export default [
  {
    files: ['../script.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: { ...globals.browser, Tone: 'readonly' },
    },
    rules: { 'no-undef': 'error' },
  },
  {
    files: ['../bell-engine.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: { ...globals.browser, ...globals.node },
    },
    rules: { 'no-undef': 'error' },
  },
];
