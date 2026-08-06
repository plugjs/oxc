import { execFile } from 'node:child_process'
import { readFile } from 'node:fs/promises'
import { findPackageJSON } from 'node:module'

import { $p, $wht, assert, BuildFailure } from '@plugjs/plug'
import { assertAbsolutePath, resolveFile } from '@plugjs/plug/paths'

import type { Context } from '@plugjs/plug/pipe'

export async function spawnBinary(options: {
  context: Context
  packageName: string
  binaryName?: string
  args?: string[]
  paths?: string[]
  cwd?: string
  ignoreStderr?: boolean
}): Promise<{ code: number; stdout: string; stderr: string }> {
  const {
    context, // the context for logging
    packageName, // the package name to look for
    binaryName = packageName, // the binary in the package (defaults to same)
    args = [], // arguments to pass to the binary (and logged)
    paths = [], // the list of file paths to pass to the binary (not logged)
    cwd = '.', // current working directory for the binary (defaults to current)
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

  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    context.log.info(
      `Spawning "${$wht(binaryName)}" from "${$p(resolved)}" with args:`,
      args,
      ...(paths.length ? ['and', paths.length, 'files'] : []),
    )

    // Spawn the child process
    execFile(
      resolved,
      [...args, ...paths],
      {
        env: { PATH: process.env['PATH'] }, // zero out the environment
        cwd: context.resolve(cwd), // use the specified working directory
      },
      (error, stdout, stderr) => {
        if (!error) {
          return resolve({ code: 0, stdout, stderr })
        } else if (typeof error.code === 'number') {
          return resolve({ code: error.code, stdout, stderr })
        } else /* coverage ignore next */ if (error.signal) {
          return reject(new BuildFailure(`Process "${binaryName}" was killed by signal ${error.signal}`))
        } else {
          return reject(new BuildFailure(`Process "${binaryName}" failed with unknown error: ${error.message}`))
        }
      },
    )
  })
}
