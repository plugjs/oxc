import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { findPackageJSON } from 'node:module'
import { delimiter } from 'node:path'

import { $p, $wht, assert, BuildFailure } from '@plugjs/plug'
import { assertAbsolutePath, resolveDirectory, resolveFile } from '@plugjs/plug/paths'
import stripansi from 'strip-ansi'

import type { AbsolutePath } from '@plugjs/plug/paths'
import type { Context } from '@plugjs/plug/pipe'

export async function spawnBinary(options: {
  context: Context
  packageName: string
  binaryName?: string
  args?: string[]
  paths?: string[]
  cwd: AbsolutePath
}): Promise<{ code: number; stdout: string; stderr: string }> {
  const {
    context, // the context for logging
    packageName, // the package name to look for
    binaryName = packageName, // the binary in the package (defaults to same)
    args = [], // arguments to pass to the binary (and logged)
    paths = [], // the list of file paths to pass to the binary (not logged)
    cwd, // current working directory for the binary
  } = options

  // Find the package.json for the specified package
  const packageFile = findPackageJSON(packageName, import.meta.url)
  assert(packageFile, `Could not find "package.json" for package "${packageName}"`)
  assertAbsolutePath(packageFile)

  // Read the package.json and find the binary file
  const packageData = JSON.parse(await readFile(packageFile, 'utf-8'))
  const binaryFile = packageData?.['bin']?.[binaryName]
  assert(binaryFile, `Could not find "${binaryName}" executable in package "${packageName}"`)

  // Resolve the path to the binary file
  const resolved = resolveFile(packageFile, '..', binaryFile)
  assert(resolved, `Could not resolve path to "${binaryName}" executable in package "${packageName}"`)

  // Make sure any companion binaries from this package's dependency tree are
  // available to the spawned process.
  const packageBinDir = resolveDirectory(packageFile, '..', '..', '.bin')
  const PATH = [packageBinDir, process.env['PATH']].filter(Boolean).join(delimiter)

  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    context.log.info(
      `Spawning "${$wht(binaryName)}" from "${$p(resolved)}" with args:`,
      args,
      ...(paths.length ? ['and', paths.length, 'files'] : []),
    )

    // Spawn the child process
    const child = execFile(
      resolved,
      [...args, ...paths],
      { env: { ...process.env, PATH }, cwd: cwd, maxBuffer: 10 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (!error) {
          return resolve({ code: 0, stdout: stripansi(stdout), stderr: stripansi(stderr) })
        } else if (typeof error.code === 'number') {
          return resolve({ code: error.code, stdout: stripansi(stdout), stderr: stripansi(stderr) })
        } else /* coverage ignore next */ if (error.signal) {
          return reject(new BuildFailure(`Process "${binaryName}" [${child.pid}] killed by signal ${error.signal}`))
        } else {
          return reject(new BuildFailure(`Process "${binaryName}" [${child.pid}] failed`, [error]))
        }
      },
    )

    // Log when the child process is spawned
    child.on('spawn', () => context.log.debug(`Spawned "${$wht(binaryName)}" [${child.pid}]`))
  })
}
