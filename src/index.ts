import { install } from '@plugjs/plug/pipe'

import { OXFmt } from './oxfmt.ts'
import { OXLint } from './oxlint.ts'

/* ========================================================================== *
 * OPTIONS DEFINITIONS                                                        *
 * ========================================================================== */

/** Options to run _OXLint_ as a PlugJS' `Plug` */
export interface OXLintPlugOptions {
  /** The path to the OXLint configuration file. */
  config?: string
  /** The path to the TypeScript configuration file. */
  tsConfig?: string
  /** Whether to automatically fix linting errors (default: `false`). */
  fix?: boolean
  /** Whether to report unused disable directives (default: `true`). */
  reportUnusedDisableDirectives?: boolean
  /** The current working directory for OXLint (default: the current one) */
  cwd?: string
}

/** Options to run _OXLint_ standalone in a task */
export interface OXLintOptions extends OXLintPlugOptions {
  /** The list of globs to lint. */
  paths?: string[]
}

/* ========================================================================== */

/** Options to run _OXFmt_ as a PlugJS' `Plug` */
export interface OXFmtPlugOptions {
  /** The path to the OXFmt configuration file. */
  config?: string
  /** Whether to automatically fix formatting errors (default: `false`). */
  fix?: boolean
  /**
   * Whether to report formatting inconsistencies as `WARNING` messages instead
   * of `ERROR` messages (default: `false`).
   */
  warnOnFormat?: boolean
  /** The current working directory for OXFmt (default: the current one) */
  cwd?: string
}

/** Options to run _OXFmt_ standalone in a task */
export interface OXFmtOptions extends OXFmtPlugOptions {
  /** The list of globs to format. */
  paths?: string[]
}

/* ========================================================================== */

/** Options to run both _OXFmt_ and _OXLint_ as a PlugJS' `Plug` */
export interface OXCPlugOptions extends Omit<OXFmtPlugOptions, 'config'>, Omit<OXLintPlugOptions, 'config'> {
  /** The path to the OXLint configuration file. */
  oxlintConfig?: string
  /** The path to the OXFmt configuration file. */
  oxfmtConfig?: string
}

/** Options to run both _OXFmt_ and _OXLint_ standalone in a task */
export interface OXCOptions extends OXCPlugOptions {
  /** The list of globs to format and lint. */
  paths?: string[]
}

/* ========================================================================== *
 * PLUGJS DEFINITION                                                          *
 * ========================================================================== */

declare module '@plugjs/plug' {
  export interface Pipe {
    /**
     * Run {@link https://oxc.rs/docs/guide/usage/formatter.html _OXFmt_} over
     * the input source files using the configuration defaults (either from a
     * local `.oxfmtrc.*` file or the default configuration).
     */
    oxfmt(): Promise<Pipe>

    /**
     * Run {@link https://oxc.rs/docs/guide/usage/formatter.html _OXFmt_} over
     * the input source files, using the configuration from the specified
     * `configFile`.
     *
     * @param configFile The configuration file to use
     */
    oxfmt(configFile: string): Promise<Pipe>

    /**
     * Run {@link https://oxc.rs/docs/guide/usage/formatter.html _OXFmt_} over
     * the input source files.
     *
     * @param options {@link OXFmtPlugOptions | Options} to pass to _OXFmt_
     */
    oxfmt(options: OXFmtPlugOptions): Promise<Pipe>

    /* ====================================================================== */

    /**
     * Run {@link https://oxc.rs/docs/guide/usage/linter.html _OXLint_} over
     * the input source files using the configuration defaults (either from a
     * local `.oxlintrc.*` file or the default configuration).
     */
    oxlint(): Promise<Pipe>

    /**
     * Run {@link https://oxc.rs/docs/guide/usage/linter.html _OXLint_} over
     * the input source files, using the configuration from the specified
     * `configFile`.
     *
     * @param configFile The configuration file to use
     */
    oxlint(configFile: string): Promise<Pipe>

    /**
     * Run {@link https://oxc.rs/docs/guide/usage/linter.html _OXLint_} over
     * the input source files.
     *
     * @param options {@link OXLintPlugOptions | Options} to pass to _OXLint_
     */
    oxlint(options: OXLintPlugOptions): Promise<Pipe>
  }
}

install('oxfmt', OXFmt)
install('oxlint', OXLint)

/* Export utility functions */
export { oxfmt } from './oxfmt.ts'
export { oxlint } from './oxlint.ts'
