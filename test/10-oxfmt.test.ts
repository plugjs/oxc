import { $p, async, BuildFailure, find, mkdtemp, rmrf } from '@plugjs/plug'
import { readFile, writeFile } from '@plugjs/plug/fs'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { Context } from '@plugjs/plug/pipe'

import { oxfmt, OXFmt } from '../src/oxfmt.ts'

import type { AbsolutePath } from '@plugjs/plug'
import type { OxfmtConfig } from 'oxfmt'

describe('OXFmt', () => {
  let tempDir: AbsolutePath
  let context: Context

  function writeConfig(config: OxfmtConfig, file: string = '.oxfmtrc.json'): Promise<void> {
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

  describe('OXFmt Plug', () => {
    it('should fail with parsing errors', () =>
      async.runAsync(context, async () => {
        await expect(find('**/*', { directory: tempDir }).plug(new OXFmt())) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should fail when files are not formatted correctly', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*'],
        })

        await expect(find('**/*', { directory: tempDir }).plug(new OXFmt())) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should warn when formatting inconsistencies should not fail the build', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*'],
        })

        await find('**/*', { directory: tempDir }).plug(new OXFmt({ warnOnFormat: true }))
      }))

    it('should fail when warning but parsing errors are found', () =>
      async.runAsync(context, async () => {
        await expect(find('**/*', { directory: tempDir }).plug(new OXFmt({ warnOnFormat: true }))) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should succeed with nothing to report', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*', '**/warnings.ts'],
          semi: false,
        })

        await find('**/*', { directory: tempDir }).plug(new OXFmt())
      }))

    it('should fail when no files are being formatted', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/*'],
          },
          'my-oxfmt-config.json',
        )

        await expect(
          find('**/*', { directory: tempDir }).plug(new OXFmt('@/my-oxfmt-config.json')),
        ).toBeRejectedWithError(BuildFailure)

        await expect(
          find('bogus.ts', { directory: tempDir }).plug(new OXFmt('')), //
        ).toBeRejectedWithError(BuildFailure)
      }))

    it('should fix issues using a non-standard config files', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/invalid*'],
            singleQuote: true,
          },
          'my-oxfmt-config.json',
        )

        await writeConfig({}, 'my-tsconfig.json')

        await find('**/*', { directory: tempDir }).plug(
          new OXFmt({
            config: '@/my-oxfmt-config.json',
            fix: true,
          }),
        )

        const contents = await readFile(resolveAbsolutePath(tempDir, 'resources/warnings.ts'), 'utf-8')
        expect(contents).toEqual("if ((!'foo') in {}) {\n}\nlet warning = true;\n")
      }))
  })

  describe('OXFmt Utility', () => {
    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await expect(oxfmt()).toBeRejectedWithError(BuildFailure)
        } finally {
          process.chdir(cwd)
        }
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/warnings.ts', '**/invalid*', '**/.*'],
          semi: false,
        })

        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await oxfmt('resources')
        } finally {
          process.chdir(cwd)
        }
      }))
  })
})
