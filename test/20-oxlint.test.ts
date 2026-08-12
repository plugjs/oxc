import { async, BuildFailure, find, mkdtemp } from '@plugjs/plug'
import { readFile, realpath, rm, writeFile } from '@plugjs/plug/fs'
import { $gry, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { resolveAbsolutePath } from '@plugjs/plug/paths'
import { Context } from '@plugjs/plug/pipe'

import { lint, OXLint, oxlint } from '../src/oxlint.ts'
import { MockReport } from './mock-report.ts'

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
    tempDir = (await realpath(mkdtemp())) as AbsolutePath
    await find('resources/**/*', { directory: 'test' }).copy(tempDir)
    const buildFile = resolveAbsolutePath(tempDir, 'build.ts')
    context = new Context(buildFile, async.requireContext().taskName)
  })

  afterEach(async () => {
    await rm(tempDir, { recursive: true })
  })

  describe('OXLint Linting', () => {
    it('should report errors when files can not be parsed', async () => {
      const report = new MockReport()
      await writeConfig({ ignorePatterns: ['**/*.ts'] })
      await lint({ cwd: '@' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: ERROR,
          file: context.resolve('@/resources/invalid.js'),
          line: 1,
          column: 5,
          length: 0,
          message: expect.toMatch('semicolon'), // "Expected a semicolon or ..."
          tags: ['oxlint'],
        },
        {
          level: ERROR,
          file: context.resolve('@/resources/invalid2.js'),
          line: 14,
          column: 10,
          length: 0,
          message: expect.toMatch('semicolon'), // "Expected a semicolon or ..."
          tags: ['oxlint'],
        },
        {
          level: ERROR,
          message: expect.toMatch('files'), // "Error occurred when checking code style in the above files"
          tags: ['oxlint'],
        },
      ])
    })

    it('should report warnings and errors when files are not linted correctly', async () => {
      const report = new MockReport()
      await writeConfig({ ignorePatterns: ['**/invalid*'], rules: { 'no-console': 'error' } })
      await lint({ cwd: '@' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: WARN,
          file: context.resolve('@/resources/warnings.ts'),
          message: expect.toMatch(/["']warning["']/), // "Variable 'warning' is declared used."
          line: 3,
          column: 5,
          length: 7,
          tags: ['eslint(no-unused-vars)'],
        },
        {
          level: ERROR,
          file: context.resolve('@/resources/test.ts'),
          message: expect.toMatch(/console/), // "Unexpected console statement."
          line: 1,
          column: 1,
          length: 11,
          tags: ['eslint(no-console)'],
        },
        {
          level: ERROR,
          message: expect.toMatch(/^Finished.*threads/), // "Finished in 23ms on 1 files using 12 threads."
          tags: ['oxlint'],
        },
      ])
    })

    it('should report warnings using an alternative configuration file', async () => {
      const report = new MockReport()
      await writeConfig({ ignorePatterns: ['**/invalid*'] }, 'my-oxlint-config.json')
      await writeConfig({}, 'my-ts-config.json')
      await lint(
        {
          cwd: '@',
          config: '@/my-oxlint-config.json',
          tsConfig: '@/my-ts-config.json',
        },
        context,
        report,
        ['resources'],
      )
      expect(report.data).toMatchContents([
        {
          level: WARN,
          file: context.resolve('@/resources/warnings.ts'),
          message: expect.toMatch(/["']warning["']/), // "Variable 'warning' is declared used."
          line: 3,
          column: 5,
          length: 7,
          tags: ['eslint(no-unused-vars)'],
        },
        {
          level: NOTICE,
          message: expect.toMatch(/^Finished.*threads/), // "Finished in 23ms on 1 files using 12 threads."
          tags: ['oxlint'],
        },
      ])
    })

    it('should report success when files are linted correctly', async () => {
      const report = new MockReport()
      await writeConfig({ ignorePatterns: ['**/invalid*'], rules: { 'no-unused-vars': 'off' } })
      await lint({ cwd: '@' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: NOTICE,
          message: expect.toMatch(/^Finished.*threads/), // "Finished in 23ms on 1 files using 12 threads."
          tags: ['oxlint'],
        },
      ])
    })

    it('should report an error when all files are being ignored', async () => {
      const report = new MockReport()
      await writeConfig({ ignorePatterns: ['**/*.ts', '**/*.js'] })
      await lint({ cwd: '@' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: ERROR,
          message: expect.toMatch('files found'), // "No files found to lint. Please check your paths and ignore patterns."
          tags: ['oxlint'],
        },
        {
          level: ERROR,
          message: expect.toMatch(/^Finished.*threads/), // "Finished in 23ms on 1 files using 12 threads."
          tags: ['oxlint'],
        },
      ])
    })

    it('should correctly handle extra stderr and stdout output', async () => {
      const configFile = resolveAbsolutePath(tempDir, 'oxlint.config.ts')
      await writeFile(
        configFile,
        `// Fake config
         console.log("This goes to STDOUT");
         console.error("This goes to STDERR");
         export default {
           ignorePatterns: ['**/invalid*'],
           rules: { 'no-unused-vars': 'warn', 'no-console': 'warn' },
         };`,
        'utf-8',
      )

      const report = new MockReport()
      await lint({ cwd: '@' }, context, report, ['resources'])
      expect(report.data).toMatchContents([
        {
          level: WARN,
          file: context.resolve('@/resources/warnings.ts'),
          message: expect.toMatch(/["']warning["']/), // "Variable 'warning' is declared used."
          line: 3,
          column: 5,
          length: 7,
          tags: ['eslint(no-unused-vars)'],
        },
        {
          level: WARN,
          file: context.resolve('@/resources/test.ts'),
          message: expect.toMatch(/console/), // "Unexpected console statement."
          line: 1,
          column: 1,
          length: 11,
          tags: ['eslint(no-console)'],
        },
        {
          level: NOTICE,
          message: 'This goes to STDOUT',
          tags: ['oxlint'],
        },
        {
          level: WARN,
          message: 'This goes to STDERR',
          tags: ['oxlint'],
        },
        {
          level: NOTICE,
          message: expect.toMatch(/^Finished.*threads/), // "Finished in 23ms on 1 files using 12 threads."
          tags: ['oxlint'],
        },
      ])
    })

    it('should work when no json report is produced', async () => {
      const report = new MockReport()
      await lint({ cwd: '@' }, context, report, ['--wrong-option'])
      expect(report.data).toMatchContents([
        {
          level: WARN,
          message: expect.toMatch(/wrong-option/),
          tags: ['oxlint'],
        },
        {
          level: ERROR,
          message: expect.toMatch(/^Finished.*threads/), // "Error: `--wrong-option` is not expected in this context"
          tags: ['oxlint'],
        },
      ])
    })

    it('should correctly fix sources when asked to do so', async () => {
      const filename = resolveAbsolutePath(tempDir, 'resources/warnings.ts')

      const before = await readFile(filename, 'utf-8')
      expect(before).toEqual('if ((!"foo") in {}) {\n}\nlet warning = true;\n')

      const report = new MockReport()
      await writeConfig({
        ignorePatterns: ['**/invalid*'],
        rules: {
          'no-unused-vars': 'off',
          'prefer-const': 'error',
          'unicorn/empty-brace-spaces': 'error',
        },
      })
      await lint({ cwd: '@', fix: true }, context, report, ['resources/warnings.ts'])
      expect(report.data).toMatchContents([
        {
          level: NOTICE,
          message: expect.toMatch(/^Finished.*threads/), // "Finished in 23ms on 1 files using 12 threads."
          tags: ['oxlint'],
        },
      ])

      const after = await readFile(filename, 'utf-8')
      expect(after).toEqual('if ((!"foo") in {}) {}\nconst warning = true;\n')
    })
  })

  describe('OXLint Plug', () => {
    beforeEach(async () => log.notice($gry('+--------------------------------------------------------------')))
    afterEach(async () => log.notice($gry('+--------------------------------------------------------------')))

    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        await expect(find('**/*', { directory: tempDir }).plug(new OXLint({ cwd: '@' }))) //
          .toBeRejectedWithError(BuildFailure)
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/invalid*'],
            rules: { 'no-console': 'warn' },
          },
          'my-oxlint-config.json',
        )

        await find('**/*', { directory: tempDir }).plug(new OXLint('@/my-oxlint-config.json'))
      }))

    it('should succeed with nothing to report', () =>
      async.runAsync(context, async () => {
        await writeConfig({
          ignorePatterns: ['**/invalid*'],
          rules: { 'no-unused-vars': 'off' },
        })

        await find('**/*', { directory: tempDir }).plug(new OXLint({ cwd: '@' }))
      }))

    it('should fail when all files are ignored', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/*'],
          },
          'my-oxlint-config.json',
        )

        await expect(
          find('**/test.ts', { directory: tempDir }).plug(new OXLint('@/my-oxlint-config.json')), // specific config file
        ).toBeRejectedWithError(BuildFailure)
      }))

    it('should fail when no files are to be linted', () =>
      async.runAsync(context, async () => {
        await expect(
          find('**/bozo.ts', { directory: tempDir }).plug(new OXLint('')), // empty config file
        ).toBeRejectedWithError(BuildFailure)
      }))
  })

  describe('OXLint Utility', () => {
    beforeEach(async () => log.notice($gry('+--------------------------------------------------------------')))
    afterEach(async () => log.notice($gry('+--------------------------------------------------------------')))

    it('should fail with errors', () =>
      async.runAsync(context, async () => {
        await expect(oxlint({ cwd: '@' })).toBeRejectedWithError(BuildFailure)
      }))

    it('should succeed with warnings', () =>
      async.runAsync(context, async () => {
        await writeConfig(
          {
            ignorePatterns: ['**/invalid*', '**/.*'],
            rules: { 'no-console': 'warn' },
          },
          'my-oxlint-config.json',
        )

        await oxlint({
          paths: ['resources'],
          config: '@my-oxlint-config.json',
          cwd: '@',
        })
      }))

    it('should succeed when everything is well formatted', () =>
      async.runAsync(context, async () => {
        // Change the CWD to let OXLint find the correct paths
        const cwd = process.cwd()
        try {
          process.chdir(tempDir)
          await oxlint('resources/test.ts')
        } finally {
          process.chdir(cwd)
        }
      }))
  })
})
