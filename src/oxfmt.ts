import { async } from '@plugjs/plug'
import { realpath } from '@plugjs/plug/fs'
import { ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { assertAbsolutePath, resolveAbsolutePath } from '@plugjs/plug/paths'

import { spawnBinary } from './spawn.ts'

import type { OXFmtOptions, OXFmtPlugOptions } from './index.ts'
import type { Files } from '@plugjs/plug/files'
import type { Report } from '@plugjs/plug/logging'
import type { AbsolutePath } from '@plugjs/plug/paths'
import type { Context, Plug } from '@plugjs/plug/pipe'

/* ========================================================================== *
 * FORMAT FILES                                                               *
 * ========================================================================== */

/**
 * Format files using OXFmt and add the diagnostics to the report.
 *
 * @param options The options to build the OXFmt command line.
 * @param context The current build context.
 * @param report The report to add diagnostics to.
 * @param paths The list of file paths to format.
 */
export async function format(
  options: OXFmtPlugOptions,
  context: Context,
  report: Report,
  paths: string[],
): Promise<void> {
  // Extract options with defaults
  const { config, fix = false, warnOnFormat = false, cwd: maybeCwd } = options

  // Build the command line arguments for OXFmt
  const args = fix ? [] : ['--list-different']

  // OXFmt is finnicky with paths: for speed it never resolves symlinks, so
  // we have to be carful to resolve everything for it...
  const cwd = await realpath(context.resolve(maybeCwd || '.'))
  assertAbsolutePath(cwd)

  if (config) {
    const resolved = await realpath(context.resolve(config))
    args.push(`--config=${resolved}`)
  }

  // Spawn the OXFmt binary and capture the output
  const start = Date.now()
  const { code, stdout, stderr } = await spawnBinary({
    packageName: 'oxfmt',
    context,
    paths,
    args,
    cwd,
  })
  const duration = Date.now() - start

  // The level of the report is determined by the exit code of OXFmt:
  // - 0: All files are well formatted
  // - 1: Some files are not well formatted (WARN or ERROR, can be fixed)
  // - 2: Some files could not be parsed or no files were found
  const level = code === 0 ? NOTICE : code === 1 ? (warnOnFormat ? WARN : ERROR) : ERROR

  // When `--list-different` (not fixing) OXFmt outputs the list of different
  // files to STDOUT and error/warning messages to STDERR...
  let hasMessages = false
  if (fix) {
    stdout.split('\n').forEach((line) => {
      const message = line.trim()
      if (!message) return

      report.add({ level, message, tags: ['oxfmt'] })
      hasMessages = true
    })
  } else {
    stdout.split('\n').forEach((line) => {
      line = line.trim()
      if (!line) return

      const file = resolveAbsolutePath(cwd, line)
      report.add({ level, file, message: 'File is not well formatted', tags: ['oxfmt'] })
    })
  }

  // The hairy part of OXFmt: messages look as follows, there's no JSON output,
  // so we have to interpret the text output and add it to the report:
  //
  //   x Expected a semicolon or an implicit semicolon after a statement, but found none
  //    ,-[/var/folders/c7/qqyv7cx52h136jb96yz110v40000gn/T/plugjs-oAmlQh/resources/invalid.js:1:5]
  //  1 | this file is invalid
  //    :     ^
  //    +----
  //   help: Try inserting a semicolon here
  // Error occurred when checking code style in the above files.
  //
  // Even more hairy is the fact that on *SOME* linux distros, the delimiters
  // are unicode characters (see the regex below)...

  let message: string | undefined = undefined
  stderr.split('\n').forEach((line) => {
    let result: RegExpMatchArray | null
    // Lines starting with "  x ..." contain the error message, before the
    // line and file information... Let's store this and we'll pass
    if ((result = line.match(/^\s+[x\u00d7]\s+(.*)/)) != null) {
      message = result[1]?.trim()
    }

    // Lines starting with "  ,-[" contain the file and line information, which
    // we can parse and add to the report along with the message we stored above
    else if ((result = line.match(/^\s+[,\u{256d}][-\u{2500}]\[([^\]]+)\]/u)) != null) {
      const info = result[1]!.trim()
      let file: AbsolutePath | undefined = undefined
      let line: number | undefined = undefined
      let column: number | undefined = undefined

      // coverage ignore next // too many defaults to ignore...
      if ((result = info.match(/^(.*):(\d+):(\d+)$/)) != null) {
        file = result[1] ? resolveAbsolutePath(cwd, result[1]) : undefined
        line = parseInt(result[2] || '0') || undefined
        column = parseInt(result[3] || '0') || undefined
      } else if (info) {
        file = resolveAbsolutePath(cwd, info)
      }

      // We only add if we both have file and message...
      if (file && message) {
        report.add({ level, file, line, column, message, tags: ['oxfmt'] })
      }
    }

    // Lines *NOT* starting with a space are general / process-wide error
    // messages, we'll add them to the report as well here...
    else if ((result = line.match(/^\S.*$/)) != null) {
      const message = result[0]?.trim()
      if (message) {
        report.add({ level, message, tags: ['oxfmt'] })
        hasMessages = true
      }
    }
  })

  // coverage ignore if // can't verify this exception
  if (code !== 0 && code !== 1 && code !== 2) {
    report.add({ level: ERROR, message: `OXFmt failed with exit code ${code}`, tags: ['oxfmt'] })
  } else if (report.empty || !hasMessages) {
    report.add({ level, message: `OXFmt formatting complete ${duration} ms`, tags: ['oxfmt'] })
  }
}

/* ========================================================================== *
 * OXFMT PLUG IMPLEMENTATION                                                  *
 * ========================================================================== */

export class OXFmt implements Plug<Files> {
  private _options: OXFmtPlugOptions

  constructor()
  constructor(configFile: string)
  constructor(options: OXFmtPlugOptions)
  constructor(optionsOrConfigFile: string | OXFmtPlugOptions = {}) {
    if (typeof optionsOrConfigFile === 'string') {
      this._options = { config: optionsOrConfigFile || undefined }
    } else {
      this._options = optionsOrConfigFile
    }
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    const report = context.log.report('OXFmt Report')

    if (files.length === 0) {
      // No files? No report! (But make it look similar to a normal report)
      report.add({
        level: ERROR,
        message: 'No files found to format. Please check your paths and ignore patterns.',
        tags: ['oxfmt'],
      })
    } else {
      // Run OXFmt on the files and add the diagnostics to the report
      await format(this._options, context, report, [...files.absolutePaths()])
    }

    // Load the sources for the report and mark it as done
    await report.loadSources()
    report.done(true)
    return files
  }
}

/* ========================================================================== *
 * OXFMT RUNNER IMPLEMENTATION                                                *
 * ========================================================================== */

/** Run OXFmt using defaults */
export async function oxfmt(): Promise<void>
/** Run OXFmt using on the specified paths using the default options */
export async function oxfmt(...paths: string[]): Promise<void>
/** Run OXFmt using the specified options */
export async function oxfmt(options: OXFmtOptions): Promise<void>
/* Overload implementation */
export async function oxfmt(
  optionsOrFirstPath: string | OXFmtOptions = {},
  ...additionalPaths: string[]
): Promise<void> {
  const options: OXFmtOptions = {}
  const paths: string[] = []

  if (typeof optionsOrFirstPath === 'string') {
    paths.push(optionsOrFirstPath)
  } else if (typeof optionsOrFirstPath === 'object') {
    Object.assign(options, optionsOrFirstPath)
    paths.push(...(options.paths || []))
  }

  paths.push(...additionalPaths)

  const context = async.requireContext()
  const report = context.log.report('OXFmt Report')
  await format(options, context, report, paths)

  // Load the sources for the report and mark it as done
  await report.loadSources()
  report.done(true)
}
