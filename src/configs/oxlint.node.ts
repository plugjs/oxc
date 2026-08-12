import { defineConfig } from 'oxlint'

import config from './oxlint.ts'

export default defineConfig({
  extends: [config],
  ignorePatterns: ['test/resources'],
  plugins: ['node'],
  env: { ...config.env, node: true },

  overrides: [
    {
      files: ['test/**/*'],
      globals: {
        describe: 'readonly',
        fdescribe: 'readonly',
        xdescribe: 'readonly',
        it: 'readonly',
        fit: 'readonly',
        xit: 'readonly',
        afterAll: 'readonly',
        afterEach: 'readonly',
        beforeAll: 'readonly',
        beforeEach: 'readonly',
        xafterAll: 'readonly',
        xafterEach: 'readonly',
        xbeforeAll: 'readonly',
        xbeforeEach: 'readonly',
        skip: 'readonly',
        expect: 'readonly',
        log: 'readonly',
        // those are deprecated: they were used before import.meta.dirname and
        // import.meta.filename existed on Node.js, but are still used somewhere
        // dirnameFromUrl: 'readonly',
        // filenameFromUrl: 'readonly',
      },
    },
  ],
})
