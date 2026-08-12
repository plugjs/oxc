import { async } from '@plugjs/plug'
import { ERROR } from '@plugjs/plug/logging'

import { format } from './oxfmt.ts'
import { lint } from './oxlint.ts'

import type { OXCOptions, OXCPlugOptions, OXFmtPlugOptions, OXLintPlugOptions } from './index.ts'
import type { Files } from '@plugjs/plug/files'
import type { Context, Plug } from '@plugjs/plug/pipe'

/* ========================================================================== *
 * OXC PLUG IMPLEMENTATION                                                    *
 * ========================================================================== */

export class OXC implements Plug<Files> {
  constructor(private _options: OXCPlugOptions = {}) {}

  async pipe(files: Files, context: Context): Promise<Files> {
    const report = context.log.report('OXC Report')

    const oxfmtOptions: OXFmtPlugOptions = { ...this._options }
    const oxlintOptions: OXLintPlugOptions = { ...this._options }
    oxfmtOptions.config = this._options.oxfmtConfig
    oxlintOptions.config = this._options.oxlintConfig

    if (files.length === 0) {
      // No files? No report! (But make it look similar to a normal report)
      report.add({ level: ERROR, message: 'No files found to format. Please check your paths and ignore patterns.' })
    } else {
      // Run OXFmt on the files *first* and add the diagnostics to the report.
      // We run this *first* to make sure that the formatter has time to fix any
      // issues before we run the linter, which may otherwise report errors
      // that have already been fixed.
      await format(oxfmtOptions, context, report, [...files.absolutePaths()])
      // Then run OXLint on the files and add the diagnostics to the report
      await lint(oxlintOptions, context, report, [...files.absolutePaths()])
    }

    // Load the sources for the report and mark it as done
    await report.loadSources()
    report.done(true)
    return files
  }
}

/* ========================================================================== *
 * OXC RUNNER IMPLEMENTATION                                                  *
 * ========================================================================== */

/** Run OXLint using defaults */
export async function oxc(): Promise<void>
/** Run OXLint on the specified paths using the default options */
export async function oxc(...paths: string[]): Promise<void>
/** Run OXLint using the specified options */
export async function oxc(options: OXCOptions): Promise<void>
/* Overload implementation */
export async function oxc(optionsOrFirstPath: string | OXCOptions = {}, ...additionalPaths: string[]): Promise<void> {
  const options: OXCOptions = {}
  const paths: string[] = []

  if (typeof optionsOrFirstPath === 'string') {
    paths.push(optionsOrFirstPath)
  } else if (typeof optionsOrFirstPath === 'object') {
    Object.assign(options, optionsOrFirstPath)
    paths.push(...(options.paths || []))
  }

  paths.push(...additionalPaths)

  const oxfmtOptions: OXFmtPlugOptions = { ...options }
  const oxlintOptions: OXLintPlugOptions = { ...options }
  oxfmtOptions.config = options.oxfmtConfig
  oxlintOptions.config = options.oxlintConfig

  const context = async.requireContext()
  const report = context.log.report('OXC Report')
  await format(oxfmtOptions, context, report, paths)
  await lint(oxlintOptions, context, report, paths)

  // Load the sources for the report and mark it as done
  await report.loadSources()
  report.done(true)
}
