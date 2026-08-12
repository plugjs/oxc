import { async, BuildFailure, find, mkdtemp } from '@plugjs/plug'
import { readFile, rm, writeFile } from '@plugjs/plug/fs'
import { $gry, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { Context } from '@plugjs/plug/pipe'

import { format, oxfmt, OXFmt } from '../src/oxfmt.ts'
import { MockReport } from './mock-report.ts'

import type { AbsolutePath } from '@plugjs/plug'
import type { OxfmtConfig } from 'oxfmt'

describe('OXFmt', () => {
  let tempDir: AbsolutePath
  let context: Context

  function writeConfig(config: OxfmtConfig, file: string = '.oxfmtrc.json'): Promise<void> {
    const configFile = resolveAbsolutePath(tempDir, file)
    return writeFile(configFile, JSON.stringify(config, null, 2) + '\n', 'utf-8')
  }

  beforeEach(async () => {
    tempDir = mkdtemp()
    await find('resources/**/*', { directory: 'test' }).copy(tempDir)
    const buildFile = resolveAbsolutePath(tempDir, 'build.ts')
    context = new Context(buildFile, async.requireContext().taskName)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  describe('OXFmt Formatting', () => {
    it('should report errors when files can not be parsed', async () => {
      const report = new MockReport()
      await writeConfig({ semi: false, ignorePatterns: ['**/*.ts'] })
      await format({ cwd: '@' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: ERROR,
          file: context.resolve('@/resources/invalid.js'),
          line: 1,
          column: 5,
          message: expect.toMatch('semicolon'), // "Expected a semicolon or ..."
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          file: context.resolve('@/resources/invalid2.js'),
          line: 14,
          column: 10,
          message: expect.toMatch('semicolon'), // "Expected a semicolon or ..."
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          message: expect.toMatch('files'), // "Error occurred when checking code style in the above files"
          tags: ['oxfmt'],
        },
      ])
    })

    it('should report errors when files ares not formatted correctly', async () => {
      const report = new MockReport()
      await writeConfig({ semi: false, ignorePatterns: ['**/invalid*'] })
      await format({ cwd: '@' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: ERROR,
          file: context.resolve('@/resources/test.ts'),
          message: 'File is not well formatted',
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          file: context.resolve('@/resources/warnings.ts'),
          message: 'File is not well formatted',
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          message: expect.toMatch(/^OXFmt formatting complete \d+ ms$/), // This is *our* message
          tags: ['oxfmt'],
        },
      ])
    })

    it('should report warnings when formatting inconsistencies should not fail the build', async () => {
      const report = new MockReport()
      await writeConfig({ semi: false, ignorePatterns: ['**/invalid*'] })
      await format({ cwd: '@', warnOnFormat: true }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: WARN,
          file: context.resolve('@/resources/warnings.ts'),
          message: 'File is not well formatted', // This is *our* message
          tags: ['oxfmt'],
        },
        {
          level: WARN,
          file: context.resolve('@/resources/test.ts'),
          message: 'File is not well formatted', // This is *our* message
          tags: ['oxfmt'],
        },
        {
          level: WARN,
          message: expect.toMatch(/^OXFmt formatting complete \d+ ms$/), // This is *our* message
          tags: ['oxfmt'],
        },
      ])
    })

    it('should still report errors when files ares not formatted correctly but formatting should warn', async () => {
      const report = new MockReport()
      await writeConfig({ semi: false })
      await format({ cwd: '@', warnOnFormat: true }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: ERROR,
          file: context.resolve('@/resources/invalid.js'),
          line: 1,
          column: 5,
          message: expect.toMatch('semicolon'), // "Expected a semicolon or ..."
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          file: context.resolve('@/resources/invalid2.js'),
          line: 14,
          column: 10,
          message: expect.toMatch('semicolon'), // "Expected a semicolon or ..."
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          file: context.resolve('@/resources/test.ts'),
          message: 'File is not well formatted',
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          file: context.resolve('@/resources/warnings.ts'),
          message: 'File is not well formatted',
          tags: ['oxfmt'],
        },
        {
          level: ERROR,
          message: expect.toMatch('files'), // "Error occurred when checking code style in the above files"
          tags: ['oxfmt'],
        },
      ])
    })

    it('should report an error when no files are being formatted', async () => {
      const report = new MockReport()
      await writeConfig({ semi: false })
      await format({ cwd: '@', warnOnFormat: true }, context, report, ['nothing'])
      expect(report.data).toMatchContents([
        {
          level: ERROR,
          message: expect.toMatch('one target file'), // "Expected at least one target file..."
          tags: ['oxfmt'],
        },
      ])
    })

    it('should report an error when all files are being ingored', async () => {
      const report = new MockReport()
      await writeConfig({ semi: false, ignorePatterns: ['**/*.ts', '**/*.js'] })
      await format({ cwd: '@', warnOnFormat: true }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: ERROR,
          message: expect.toMatch('one target file'), // "Expected at least one target file..."
          tags: ['oxfmt'],
        },
      ])
    })

    it('should report success when everything is well formatted', async () => {
      const report = new MockReport()
      await writeConfig({ semi: true, ignorePatterns: ['**/warnings.ts', '**/invalid*'] })
      await format({ cwd: '@', warnOnFormat: true }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: NOTICE,
          message: expect.toMatch(/^OXFmt formatting complete \d+ ms$/), // This is *our* message
          tags: ['oxfmt'],
        },
      ])
    })

    it('should report success when everything is well formatted using an alternative config', async () => {
      const report = new MockReport()
      await writeConfig({ semi: true, ignorePatterns: ['**/warnings.ts', '**/invalid*'] }, 'my-oxfmt-config.json')
      await format({ cwd: '@', config: '@/my-oxfmt-config.json' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: NOTICE,
          message: expect.toMatch(/^OXFmt formatting complete \d+ ms$/), // This is *our* message
          tags: ['oxfmt'],
        },
      ])
    })

    it('should fix sources and report success when formatting could be fixed', async () => {
      const filename = resolveAbsolutePath(tempDir, 'resources/test.ts')

      const before = await readFile(filename, 'utf-8')
      expect(before).toEqual('console.log("This is a test");\n')

      const report = new MockReport()
      await writeConfig({ semi: false, singleQuote: true, ignorePatterns: ['**/warnings.ts', '**/invalid*'] })
      await format({ cwd: '@', warnOnFormat: true, fix: true }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: NOTICE,
          message: expect.toMatch(/^Finished.*threads/), // "Finished in 23ms on 1 files using 12 threads."
          tags: ['oxfmt'],
        },
      ])

      const after = await readFile(filename, 'utf-8')
      expect(after).toEqual("console.log('This is a test')\n")
    })
  })

  describe('OXFmt Plug', () => {
    beforeEach(async () => log.notice($gry('+--------------------------------------------------------------')))
    afterEach(async () => log.notice($gry('+--------------------------------------------------------------')))

    it('should fail with parsing errors', async () =>
      async.runAsync(context, async () => {
        await expect(find('**/*', { directory: tempDir }).plug(new OXFmt())) // default config file
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should warn when formatting inconsistencies should not fail the build', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*'],
        })

        await find('**/*', { directory: tempDir }).plug(new OXFmt({ warnOnFormat: true })) // default config file
      }))

    it('should fail when all files are ignored', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/*'],
          },
          'my-oxfmt-config.json',
        )

        await expect(
          find('**/test.ts', { directory: tempDir }).plug(new OXFmt('@/my-oxfmt-config.json')), // specific config file
        ).toBeRejectedWithError(BuildFailure)
      }))

    it('should fail when no files files are to be formatted', () =>
      async.runAsync(context, async () => {
        await expect(
          find('**/bozo.ts', { directory: tempDir }).plug(new OXFmt('')), // empty config file
        ).toBeRejectedWithError(BuildFailure)
      }))
  })

  describe('OXFmt Utility', () => {
    beforeEach(async () => log.notice($gry('+--------------------------------------------------------------')))
    afterEach(async () => log.notice($gry('+--------------------------------------------------------------')))

    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        // Change the CWD to to parse all the files in the temporary directory
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
        await writeConfig(
          {
            ignorePatterns: ['**/warnings.ts', '**/invalid*'],
            semi: false,
          },
          'my-oxfmt-config.json',
        )

        // Change the CWD to to parse all the files in the temporary directory
        // and to find the custom configuration file
        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await oxfmt({ warnOnFormat: true, paths: ['resources'], config: 'my-oxfmt-config.json' })
        } finally {
          process.chdir(cwd)
        }
      }))

    it('should succeed when everything is well formatted', () =>
      async.runAsync(context, async () => {
        // Change the CWD to to parse relative to the temporary directory
        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await oxfmt('resources/test.ts')
        } finally {
          process.chdir(cwd)
        }
      }))
  })
})
