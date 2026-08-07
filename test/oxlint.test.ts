import { $p, async, BuildFailure, find, mkdtemp, rmrf } from '@plugjs/plug'
import { readFile, writeFile } from '@plugjs/plug/fs'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { Context } from '@plugjs/plug/pipe'

import { OXLint, oxlint } from '../src/oxlint.ts'

import type { AbsolutePath } from '@plugjs/plug'
import type { OxlintConfig } from 'oxlint'

describe('OXLint', () => {
  let tempDir: AbsolutePath
  let context: Context

  function writeConfig(config: OxlintConfig, file: string = '.oxlintrc.json'): Promise<void> {
    const configFile = resolveAbsolutePath(tempDir, file)
    return writeFile(configFile, JSON.stringify(config, null, 2), 'utf-8')
  }

  beforeEach(async () => {
    tempDir = mkdtemp()
    log.notice(`Created temporary directory ${$p(tempDir)}`)
    await find('resources/**/*', { directory: 'test' }).copy(tempDir)
    const buildFile = resolveAbsolutePath(tempDir, 'build.ts')
    context = new Context(buildFile, async.requireContext().taskName)
  })

  afterEach(async () => {
    await rmrf(tempDir)
  })

  describe('OXLint Plug', () => {
    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        await expect(find('**/*', { directory: tempDir }).plug(new OXLint())) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*'],
        })

        await find('**/*', { directory: tempDir }).plug(new OXLint())
      }))

    it('should succeed with nothing to report', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*', '**/warnings.ts'],
          rules: { 'no-unused-vars': 'off' },
        })

        await find('**/*', { directory: tempDir }).plug(new OXLint())
      }))

    it('should fail when no files are being linted', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/*'],
          },
          'my-oxlint-config.json',
        )

        await expect(find('**/*', { directory: tempDir }).plug(new OXLint('@/my-oxlint-config.json'))) //
          .toBeRejectedWithError(BuildFailure)
        await expect(find('bogus.ts', { directory: tempDir }).plug(new OXLint(''))) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should fix issues using a non-standard config files', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/invalid*'],
            rules: { 'no-unsafe-negation': 'error' },
          },
          'my-oxlint-config.json',
        )

        await writeConfig({}, 'my-tsconfig.json')

        await find('**/*', { directory: tempDir }).plug(
          new OXLint({
            config: '@/my-oxlint-config.json',
            tsConfig: '@/my-tsconfig.json',
            fix: true,
          }),
        )

        const contents = await readFile(resolveAbsolutePath(tempDir, 'resources/warnings.ts'), 'utf-8')
        expect(contents).toEqual("if (!('foo' in {})) {}\nlet warning = true;\n")
      }))
  })

  describe('OXLint Utility', () => {
    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await expect(oxlint()) //
            .toBeRejectedWithError(BuildFailure)
        } finally {
          process.chdir(cwd)
        }
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*'],
        })

        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await expect(oxlint('')) //
            .toBeResolved()
        } finally {
          process.chdir(cwd)
        }
      }))
  })
})
