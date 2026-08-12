// Re export our default configuration so that it's visible to "vscode"
// export { default } from './src/configs/oxfmt.config.ts'
import { defineConfig } from 'oxfmt'

import config from './src/configs/oxfmt.ts'

if (process.env['__DISABLE_CONFIGS__']) {
  throw new Error('Attempting to load oxfmt.config.ts while testing')
}

export default defineConfig({
  ...config,
  ignorePatterns: [...config.ignorePatterns, 'test/resources'],
})
