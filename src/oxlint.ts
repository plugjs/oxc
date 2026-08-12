import { async } from '@plugjs/plug'
import { realpath } from '@plugjs/plug/fs'
import { ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { assertAbsolutePath, resolveAbsolutePath } from '@plugjs/plug/paths'

import { spawnBinary } from './spawn.ts'

import type { OXLintOptions, OXLintPlugOptions } from './index.ts'
import type { Files } from '@plugjs/plug/files'
import type { Report } from '@plugjs/plug/logging'
import type { Context, Plug } from '@plugjs/plug/pipe'

/* ========================================================================== *
 * TYPES DEFINITION FOR OXLINT JSON FORMAT                                    *
 * ========================================================================== */

/** The result of running OXLint (from JSON). */
interface OXLintResult {
  diagnostics?: {
    /** The diagnostic message. */
    message: string
    /** The code associated with the diagnostic (e.g. `eslint(curly)`). */
    code: string
    /** The severity of the diagnostic (`error`, `warning` or some other ). */
    severity?: 'error' | 'warning' | null | undefined
    /** The URL pointing to the documentation for the linting rule */
    url?: string | null | undefined
    /** An optional help message for the diagnostic. */
    help?: string | null | undefined
    /** An optional note for the diagnostic. */
    note?: string | null | undefined
    /** The file name associated with the diagnostic. */
    filename?: string | null | undefined
    /** Locations of the diagnostic. */
    labels: {
      /** The span of the diagnostic. */
      span: {
        /** The offset of the diagnostic in the file. */
        offset: number
        /** The length of the diagnostic in the file. */
        length: number
        /** The line number of the diagnostic in the file. */
        line: number
        /** The column number of the diagnostic in the file. */
        column: number
      }
    }[]

    /**
     * **(Undocumented)** The cause of the diagnostic.
     *
     * @deprecated This is undocumented, don't really know what it is.
     */
    causes: unknown[]
    /**
     * **(Undocumented)** The related diagnostics.
     *
     * @deprecated This is undocumented, don't really know what it is.
     */
    related: unknown[]
  }[]
  /** The number of files that were linted. */
  number_of_files: number
  /** The number of linting rules. */
  number_of_rules: number
  /** The number of threads used for linting. */
  threads_count: number
  /** The start time of the linting process. */
  start_time: number
}

/* ========================================================================== *
 * LINT FILES                                                                 *
 * ========================================================================== */

/**
 * Lint files using OXLint and add the diagnostics to the report.
 *
 * @param options The options to build the OXLint command line.
 * @param context The current build context.
 * @param report The report to add diagnostics to.
 * @param paths The list of file paths to lint.
 */
export async function lint(
  options: OXLintPlugOptions,
  context: Context,
  report: Report,
  paths: string[],
): Promise<void> {
  // Extract options with defaults
  const { config, tsConfig, fix = false, reportUnusedDisableDirectives = true, cwd: maybeCwd } = options

  // Build the command line arguments for OXLint
  const args = ['--format=json', '--type-aware']
  if (reportUnusedDisableDirectives) args.push(`--report-unused-disable-directives`)
  if (fix) args.push(`--fix`)

  // OXLint is finnicky with paths: for speed it never resolves symlinks, so
  // we have to be carful to resolve everything for it...
  const cwd = await realpath(context.resolve(maybeCwd || '.'))
  assertAbsolutePath(cwd)

  if (config) {
    const resolved = await realpath(context.resolve(config))
    args.push(`--config=${resolved}`)
  }

  if (tsConfig) {
    const resolved = context.resolve(tsConfig)
    args.push(`--tsconfig=${resolved}`)
  }

  // Spawn the OXLint binary and capture the output
  const start = Date.now()
  const { code, stdout, stderr } = await spawnBinary({
    packageName: 'oxlint',
    context,
    paths,
    args,
    cwd,
  })
  const duration = Date.now() - start

  // The level of the report is determined by the exit code of OXLint
  const level = code === 0 ? NOTICE : ERROR

  // OXLint might output some non-JSON text before the JSON output, so we need
  // to find the first '{' character and parse from there
  const jsonStart = stdout.search(/{\s*"diagnostics"\s*:/)
  let preamble: string, parsed: OXLintResult
  if (jsonStart >= 0) {
    preamble = stdout.slice(0, jsonStart)
    parsed = JSON.parse(stdout.slice(jsonStart))
  } else {
    preamble = stdout
    parsed = { diagnostics: [], number_of_files: 0, number_of_rules: 0, threads_count: 0, start_time: 0 }
  }

  // Log any preamble output as warnings
  if (preamble.trim()) {
    preamble.split('\n').forEach((line) => {
      if (line.trim()) report.add({ level, message: line.trim(), tags: ['oxlint'] })
    })
  }

  // Log any stderr output as warnings
  if (stderr.trim()) {
    stderr.split('\n').forEach((line) => {
      if (line.trim()) report.add({ level: WARN, message: line.trim(), tags: ['oxlint'] })
    })
  }

  // Add the diagnostics to the report
  for (const diagnostic of parsed.diagnostics || /* coverage ignore next */ []) {
    report.add({
      file: diagnostic.filename ? resolveAbsolutePath(cwd, diagnostic.filename) : /* coverage ignore next */ undefined,
      message: diagnostic.message || /* coverage ignore next */ 'Unknown error',
      tags: [diagnostic.code || /* coverage ignore next */ 'oxlint'],
      column: diagnostic.labels?.[0]?.span?.column,
      line: diagnostic.labels?.[0]?.span?.line,
      length: diagnostic.labels?.[0]?.span?.length,
      level:
        diagnostic.severity === 'error'
          ? ERROR
          : diagnostic.severity === 'warning'
            ? WARN
            : /* coverage ignore next */ NOTICE,
    })
  }

  // Add a note about the number of files and rules processed
  const files = parsed.number_of_files === 1 ? `file` : `files`
  report.add({
    level,
    message: `Finished in ${duration}ms on ${parsed.number_of_files} ${files} using ${parsed.threads_count} threads.`,
    tags: ['oxlint'],
  })

  // coverage ignore next // can't verify this exception
  if (code !== 0 && code !== 1) {
    report.add({ level: ERROR, message: `OXLint failed with exit code ${code}`, tags: ['oxlint'] })
  } else if (report.empty) {
    if (code === 0) {
      report.add({ level: NOTICE, message: `OXLint found no issues (no diagnostics found)` })
    } else {
      report.add({ level: ERROR, message: `OXLint failed with exit code ${code} but no diagnostics were reported` })
    }
  }
}

/* ========================================================================== *
 * OXLINT PLUG IMPLEMENTATION                                                 *
 * ========================================================================== */

export class OXLint implements Plug<Files> {
  private _options: OXLintPlugOptions

  constructor()
  constructor(configFile: string)
  constructor(options: OXLintPlugOptions)
  constructor(optionsOrConfigFile: string | OXLintPlugOptions = {}) {
    if (typeof optionsOrConfigFile === 'string') {
      this._options = { config: optionsOrConfigFile || undefined }
    } else {
      this._options = optionsOrConfigFile
    }
  }

  async pipe(files: Files, context: Context): Promise<Files> {
    const report = context.log.report('OXLint Report')

    if (files.length === 0) {
      // No files? No report! (But make it look similar to a normal report)
      report.add({ level: ERROR, message: 'No files found to lint. Please check your paths and ignore patterns.' })
    } else {
      // Run OXLint on the files and add the diagnostics to the report
      await lint(this._options, context, report, [...files.absolutePaths()])
    }

    // Load the sources for the report and mark it as done
    await report.loadSources()
    report.done(true)
    return files
  }
}

/* ========================================================================== *
 * OXLINT RUNNER IMPLEMENTATION                                               *
 * ========================================================================== */

/** Run OXLint using defaults */
export async function oxlint(): Promise<void>
/** Run OXLint using on the specified paths using the default options */
export async function oxlint(...paths: string[]): Promise<void>
/** Run OXLint using the specified options */
export async function oxlint(options: OXLintOptions): Promise<void>
/* Overload implementation */
export async function oxlint(
  optionsOrFirstPath: string | OXLintOptions = {},
  ...additionalPaths: string[]
): Promise<void> {
  const options: OXLintOptions = {}
  const paths: string[] = []

  if (typeof optionsOrFirstPath === 'string') {
    paths.push(optionsOrFirstPath)
  } else if (typeof optionsOrFirstPath === 'object') {
    Object.assign(options, optionsOrFirstPath)
    paths.push(...(options.paths || []))
  }

  paths.push(...additionalPaths)

  const context = async.requireContext()
  const report = context.log.report('OXLint Report')
  await lint(options, context, report, paths)

  // Load the sources for the report and mark it as done
  await report.loadSources()
  report.done(true)
}
