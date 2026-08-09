import { defineConfig } from 'oxfmt'

export default defineConfig({
  ignorePatterns: [],

  // Inherited Defaults
  // "arrowParens": "always",
  // "bracketSpacing": true,
  // "endOfLine": "lf",
  // "insertFinalNewline": true,
  // "objectWrap": "preserve",
  // "proseWrap": "preserve",
  // "tabWidth": 2,
  // "trailingComma": "all",
  // "useTabs": false,

  // Format JSDOC comments, defaults from OXlint are OK
  jsdoc: {
    lineWrappingStyle: 'balance',
    preferCodeFences: true,
  },
  // Extended print width: 120 characters per line
  printWidth: 120,
  // Keep quotes consistent for object properties, adding when necessary
  quoteProps: 'consistent',
  // Never add semicolons at the ends of statements
  semi: false,
  // Use single quotes instead of double quotes
  singleQuote: true,
  // Sort imports in JS/TS files, including type imports
  sortImports: {
    groups: [
      ['builtin'],
      ['external'],
      ['internal', 'subpath'],
      ['parent', 'sibling', 'index'],
      ['style'],
      ['type'],
      ['unknown'],
    ],
    newlinesBetween: true,
  },

  // Sort the keys in package.json files, including scripts
  sortPackageJson: {
    sortScripts: true,
  },
})
