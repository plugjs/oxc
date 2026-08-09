// Re export our default configuration so that it's visible to "vscode"
// export { default } from './src/configs/oxfmt.config.ts'

import { defineConfig } from 'oxfmt'

import config from './src/configs/oxfmt.ts'

export default defineConfig({
  ...config,
  ignorePatterns: [...config.ignorePatterns, 'test/resources'],
})
