import { $gry, async, BuildFailure, find, mkdtemp } from '@plugjs/plug'
import { readFile, realpath, rm, writeFile } from '@plugjs/plug/fs'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { Context } from '@plugjs/plug/pipe'

import { oxc, OXC } from '../src/oxc.ts'

import type { AbsolutePath } from '@plugjs/plug'
import type { OxfmtConfig } from 'oxfmt'
import type { OxlintConfig } from 'oxlint'

describe('OXC', () => {
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
    tempDir = (await realpath(mkdtemp())) as AbsolutePath
    await find('resources/**/*', { directory: 'test' }).copy(tempDir)
    const buildFile = resolveAbsolutePath(tempDir, 'build.ts')
    context = new Context(buildFile, async.requireContext().taskName)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  describe('OXC Plug', () => {
    beforeEach(async () => log.notice($gry('+--------------------------------------------------------------')))
    afterEach(async () => log.notice($gry('+--------------------------------------------------------------')))

    it('should fail with parsing errors', () =>
      async.runAsync(context, async () => {
        await expect(find('**/*', { directory: tempDir }).plug(new OXC({ cwd: '@' }))) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeLintConfig({
          ignorePatterns: ['**/invalid*'],
        })
        await writeFormatConfig({
          ignorePatterns: ['**/invalid*'],
          semi: false,
        })

        await find('**/*', { directory: tempDir }).plug(new OXC({ cwd: '@', warnOnFormat: true }))
      }))

    it('should fail when all files are ignored', () =>
      async.runAsync(context, async () => {
        await writeLintConfig({ ignorePatterns: ['**/*'] }, 'my-oxlint-config.json')
        await writeFormatConfig({ ignorePatterns: ['**/*'] }, 'my-oxfmt-config.json')

        await expect(
          find('**/test.ts', { directory: tempDir }).plug(
            new OXC({
              oxfmtConfig: '@my-oxfmt-config.json',
              oxlintConfig: '@my-oxlint-config.json',
              cwd: '@',
            }),
          ),
        ).toBeRejectedWithError(BuildFailure)
      }))

    it('should fail when no files are found', () =>
      async.runAsync(context, async () => {
        await expect(find('**/bozo.ts', { directory: tempDir }).plug(new OXC())).toBeRejectedWithError(BuildFailure)
      }))
  })

  describe('OXC Utility', () => {
    beforeEach(async () => log.notice($gry('+--------------------------------------------------------------')))
    afterEach(async () => log.notice($gry('+--------------------------------------------------------------')))

    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        await expect(oxc({ cwd: '@' })).toBeRejectedWithError(BuildFailure)
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeLintConfig({
          ignorePatterns: ['**/invalid*'],
          rules: { 'no-console': 'warn' },
        })
        await writeFormatConfig({
          ignorePatterns: ['**/invalid*'],
        })

        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await oxc('resources')
        } finally {
          process.chdir(cwd)
        }
      }))

    it('should fix formatting and linting errors', () =>
      async.runAsync(context, async () => {
        const filename1 = resolveAbsolutePath(tempDir, 'resources/test.ts')
        const before1 = await readFile(filename1, 'utf-8')
        expect(before1).toEqual('console.log("This is a test");\n')

        const filename2 = resolveAbsolutePath(tempDir, 'resources/warnings.ts')
        const before2 = await readFile(filename2, 'utf-8')
        expect(before2).toEqual('if ((!"foo") in {}) {\n}\nlet warning = true;\n')

        await writeLintConfig({
          ignorePatterns: ['**/invalid*'],
          rules: {
            'no-unused-vars': 'off',
            'prefer-const': 'error',
            'unicorn/empty-brace-spaces': 'error',
          },
        })

        await writeFormatConfig({
          ignorePatterns: ['**/invalid*'],
          singleQuote: true,
          semi: false,
        })

        await oxc({ cwd: '@', fix: true })

        const after1 = await readFile(filename1, 'utf-8')
        expect(after1).toEqual("console.log('This is a test')\n")

        const after2 = await readFile(filename2, 'utf-8')
        expect(after2).toEqual("if ((!'foo') in {}) {}\nconst warning = true\n")
      }))
  })
})
