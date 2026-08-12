import { $p, async, BuildFailure, find, mkdtemp, rmrf } from '@plugjs/plug'
import { writeFile } from '@plugjs/plug/fs'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { Context } from '@plugjs/plug/pipe'

import { oxc, OXC } from '../src/oxc.ts'

import type { AbsolutePath } from '@plugjs/plug'
import type { OxfmtConfig } from 'oxfmt'
import type { OxlintConfig } from 'oxlint'

xdescribe('OXC', () => {
  let tempDir: AbsolutePath
  let context: Context

  function writeFormatConfig(config: OxfmtConfig, file: string = '.oxfmtrc.json'): Promise<void> {
    const configFile = resolveAbsolutePath(tempDir, file)
    return writeFile(configFile, JSON.stringify(config, null, 2), 'utf-8')
  }

  function writeLintConfig(config: OxlintConfig, file: string = '.oxlintrc.json'): Promise<void> {
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

  xdescribe('OXC Plug', () => {
    it('should fail with parsing errors', () =>
      async.runAsync(context, async () => {
        await expect(find('**/*', { directory: tempDir }).plug(new OXC())) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeLintConfig({
          ignorePatterns: ['**/invalid*'],
        })
        await writeFormatConfig({
          ignorePatterns: ['**/invalid*', '**/warnings.ts'],
          semi: false,
        })

        await find('**/*', { directory: tempDir }).plug(new OXC())
      }))

    it('should fail when no files are being linted', () =>
      async.runAsync(context, async () => {
        await writeLintConfig({ ignorePatterns: ['**/*'] })
        await writeFormatConfig({ ignorePatterns: ['**/*'] })

        await expect(find('**/*', { directory: tempDir }).plug(new OXC())) //
          .toBeRejectedWithError(BuildFailure)
        await expect(find('bogus.ts', { directory: tempDir }).plug(new OXC())) //
          .toBeRejectedWithError(BuildFailure)
      }))
  })

  xdescribe('OXLint Utility', () => {
    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await expect(oxc()).toBeRejectedWithError(BuildFailure)
        } finally {
          process.chdir(cwd)
        }
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeLintConfig({
          ignorePatterns: ['**/invalid*'],
        })
        await writeFormatConfig({
          ignorePatterns: ['**/invalid*', '**/warnings.ts'],
          semi: false,
        })

        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await oxc('resources')
        } finally {
          process.chdir(cwd)
        }
      }))
  })
})
