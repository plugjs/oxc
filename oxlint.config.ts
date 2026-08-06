// Re export our default configuration so that it's visible to "vscode"
// export { default } from './src/configs/oxfmt.config.ts'

import { defineConfig } from 'oxlint'

import config from './src/configs/oxlint.node.ts'

export default defineConfig({
  extends: [config],
  ignorePatterns: ['test/resources'],
  env: { ...config.env }, // those don't seem to be copied over
})
