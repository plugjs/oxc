import { assert, async } from '@plugjs/plug'
import { $und, $wht, $ylw, ERROR, NOTICE, WARN } from '@plugjs/plug/logging'
import { resolveAbsolutePath, resolveFile } from '@plugjs/plug/paths'
import { Context } from '@plugjs/plug/pipe'

import { spawnBinary } from './spawn.ts'

import type { OXLintOptions, OXLintPlugOptions } from './index.ts'
import type { Files } from '@plugjs/plug/files'
import type { Report } from '@plugjs/plug/logging'
import type { Plug } from '@plugjs/plug/pipe'

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
  const { config, tsConfig, fix = false, reportUnusedDisableDirectives = true, cwd } = options

  // Build the command line arguments for OXLint
  const args = ['--format=json', '--type-aware']
  if (config) {
    const resolved = context.resolve(config)
    const file = resolveFile(resolved)
    assert(file, `OXLint config file not found: ${$wht(resolved)}`)
    args.push(`--config=${file}`)
  }
  if (tsConfig) {
    const resolved = context.resolve(tsConfig)
    const file = resolveFile(resolved)
    assert(file, `OXLint TypeScript config file not found: ${$wht(resolved)}`)
    args.push(`--tsconfig=${file}`)
  }
  if (reportUnusedDisableDirectives) args.push(`--report-unused-disable-directives`)
  if (fix) args.push(`--fix`)

  // Spawn the OXLint binary and capture the output
  const { code, stdout, stderr } = await spawnBinary({
    packageName: 'oxlint',
    context,
    cwd,
    args,
    paths,
  })

  // OXLint might output some non-JSON text before the JSON output, so we need
  // to find the first '{' character and parse from there
  const jsonStart = stdout.search(/{\s*"diagnostics"\s*:/)
  let preamble: string, parsed: OXLintResult
  // coverage ignore else
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
      if (line.trim()) report.add({ level: WARN, message: line.trim() })
    })
  }

  // Log any stderr output as warnings
  // coverage ignore if
  if (stderr.trim()) {
    stderr.split('\n').forEach((line) => {
      if (line.trim()) report.add({ level: WARN, message: line.trim() })
    })
  }

  // Add the diagnostics to the report
  for (const diagnostic of parsed.diagnostics || /* coverage ignore next */ []) {
    report.add({
      file: diagnostic.filename
        ? resolveAbsolutePath(context.buildDir, diagnostic.filename)
        : /* coverage ignore next */ undefined,
      message: diagnostic.message || /* coverage ignore next */ 'Unknown error',
      tags: diagnostic.code || undefined,
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
  report.add({
    level: NOTICE,
    message: `Processed ${$ylw(parsed.number_of_files)} file(s)`,
  })

  // Finally verify the correct exit code
  // coverage ignore if
  if (code !== 0 && code !== 1) {
    report.add({ level: ERROR, message: `OXLint failed with exit code ${code}` })
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
      report.add({ level: WARN, message: 'No files found to lint. Please check your paths and ignore patterns.' })
      report.add({ level: NOTICE, message: `Processed ${$ylw(0)} file(s)` })
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
/** Run OXLint using the specified configuration file */
export async function oxlint(configFile: string): Promise<void>
/** Run OXLint using the specified options */
export async function oxlint(options: OXLintOptions): Promise<void>
/* Overload implementation */
export async function oxlint(optionsOrConfigFile: string | OXLintOptions = {}): Promise<void> {
  let options: OXLintOptions
  let paths: string[]
  if (typeof optionsOrConfigFile === 'string') {
    options = { config: optionsOrConfigFile || undefined }
    paths = []
  } else {
    options = optionsOrConfigFile
    paths = options?.paths || []
  }

  const context = async.requireContext()
  const report = context.log.report('OXLint Report')
  await lint(options, context, report, paths)

  // Load the sources for the report and mark it as done
  // coverage ignore if
  if (report.empty) {
    context.log.notice(`${$und($wht('OXLint'))} found no issues (no diagnostics found)`)
  } else {
    await report.loadSources()
    report.done(true)
  }
}
