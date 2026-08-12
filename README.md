OXFmt and OXLint support for PlugJS
===================================

This plugin adds support for [OXLint](https://oxc.rs/docs/guide/usage/linter.html)
and [OXFmt](https://oxc.rs/docs/guide/usage/formatter.html) in [PlugJS](https://github.com/plugjs/plug/)
builds.

### Contents

- [Installation](#installation)
- [Linting](#linting)
  - [Standalone linting](#standalone-linting)
- [Formatting](#formatting)
  - [Standalone formatting](#standalone-formatting)
- [Combined Formatting and Linting](#combined-formatting-and-linting)
  - [Standalone formatting and linting](#standalone-formatting-and-linting)
- [Default Configurations](#default-configurations)
- [Apache 2.0 License](./LICENSE.md)
- [Copyright Notice](./NOTICE.md)

Installation
------------

```bash
npm install --save-dev @plugjs/oxc
```

Linting
-------

Linting support is provided by the `oxlint` plug.

```typescript
import '@plugjs/oxc'
import { find, plugjs } from '@plugjs/plug'

export default plugjs({
  // ... all your other tasks
  async lint(): Promise<void> {
    await find('**/*', { directory: 'src' }).oxlint(/* ...config file or options */)
  },
})
```

The side-effect import `import '@plugjs/oxc'` installs the `.oxlint()` pipe
method.

The `oxlint` plug by default will look for the default configuration files as
specified in the OXLint documentation.

Alternatively, it can be parameterized by specifying a configuration file or a
set of options which includes the following:

- `config`: The path to the OXLint configuration file _(string)_.
- `tsConfig`: The path to the TypeScript configuration file _(string)_.
- `fix`: Whether to automatically fix linting errors _(boolean, default: `false`)_.
- `reportUnusedDisableDirectives`: Whether to report unused disable directives
  _(boolean, default: `true`)_.
- `cwd`: The current working directory for OXLint _(string, default: current
  directory)_.

### Standalone linting

OXLint can also be used directly as a utility (without piping file lists):

```typescript
import { oxlint } from '@plugjs/oxc'
import { plugjs } from '@plugjs/plug'

export default plugjs({
  // ... all your other tasks
  async lint(): Promise<void> {
    await oxlint(/* ...paths to lint or options */)
  },
})
```

In this case, the paths to lint can be specified directly as _string_ parameters
(defaulting to all files in the current directory) or using the options
specified above with the addition of:

- `paths`: The list of paths to lint _(array of strings)_.

**NOTE:** Those are _paths_, not matching globs. Specifically, OXLint does
NOT support negative globs (e.g., `!something`) and will fail if you try to
use them.

Formatting
----------

Formatting support is provided by the `oxfmt` plug.

```typescript
import '@plugjs/oxc'
import { find, plugjs } from '@plugjs/plug'

export default plugjs({
  // ... all your other tasks
  async format(): Promise<void> {
    await find('**/*', { directory: 'src' }).oxfmt(/* ...config file or options */)
  },
})
```

The side-effect import `import '@plugjs/oxc'` installs the `.oxfmt()` pipe
method.

The `oxfmt` plug by default will look for the default configuration files as
specified in the OXFmt documentation.

Alternatively, it can be parameterized by specifying a configuration file or a
set of options which includes the following:

- `config`: The path to the OXFmt configuration file _(string)_.
- `fix`: Whether to automatically fix formatting errors _(boolean, default: `false`)_.
- `warnOnFormat`: Whether to report formatting inconsistencies as warnings
  instead of errors _(boolean, default: `false`)_.
- `cwd`: The current working directory for OXFmt _(string, default: current
  directory)_.

### Standalone formatting

OXFmt can also be used directly as a utility (without piping file lists):

```typescript
import { oxfmt } from '@plugjs/oxc'
import { plugjs } from '@plugjs/plug'

export default plugjs({
  // ... all your other tasks
  async format(): Promise<void> {
    await oxfmt(/* ...paths to format or options */)
  },
})
```

In this case, the paths to format can be specified directly as _string_
parameters (defaulting to all files in the current directory) or using the
options specified above with the addition of:

- `paths`: The list of paths to format _(array of strings)_.

Combined Formatting and Linting
-------------------------------

Combined formatting and linting support is provided by the `oxc` plug. It runs
OXFmt first, then OXLint, creating a single report for both operations.

```typescript
import '@plugjs/oxc'
import { find, plugjs } from '@plugjs/plug'

export default plugjs({
  // ... all your other tasks
  async check(): Promise<void> {
    await find('**/*', { directory: 'src' }).oxc(/* ...options */)
  },
})
```

The side-effect import `import '@plugjs/oxc'` installs the `.oxc()` pipe
method.

The `oxc` plug by default will look for the default configuration files as
specified in the OXFmt and OXLint documentation.

Alternatively, it can be parameterized by specifying a set of options which
includes the following:

- `oxfmtConfig`: The path to the OXFmt configuration file _(string)_.
- `oxlintConfig`: The path to the OXLint configuration file _(string)_.
- `tsConfig`: The path to the TypeScript configuration file _(string)_.
- `fix`: Whether to automatically fix formatting and linting errors
  _(boolean, default: `false`)_.
- `warnOnFormat`: Whether to report formatting inconsistencies as warnings
  instead of errors _(boolean, default: `false`)_.
- `reportUnusedDisableDirectives`: Whether to report unused disable directives
  _(boolean, default: `true`)_.
- `cwd`: The current working directory for OXFmt and OXLint _(string, default:
  current directory)_.

### Standalone formatting and linting

OXFmt and OXLint can also be used together directly as a utility (without
piping file lists):

```typescript
import { oxc } from '@plugjs/oxc'
import { plugjs } from '@plugjs/plug'

export default plugjs({
  // ... all your other tasks
  async check(): Promise<void> {
    await oxc(/* ...paths to format and lint or options */)
  },
})
```

In this case, the paths to format and lint can be specified directly as _string_
parameters (defaulting to all files in the current directory) or using the
options specified above with the addition of:

- `paths`: The list of paths to format and lint _(array of strings)_.

**NOTE:** Those are _paths_, not matching globs. Specifically, OXLint does
NOT support negative globs (e.g., `!something`) and will fail if you try to
use them.

Default Configurations
----------------------

This package also exports default OXFmt and OXLint configurations:

- [`@plugjs/oxc/configs/oxfmt`](./src/configs/oxfmt.ts): The default OXFmt
  configuration.
- [`@plugjs/oxc/configs/oxlint`](./src/configs/oxlint.ts): The default OXLint
  configuration, kept as generic as possible.
- [`@plugjs/oxc/configs/oxlint.node`](./src/configs/oxlint.node.ts): The
  default OXLint configuration extended with the `node` plugin for Node.js
  projects.

For example, an OXFmt configuration in another project can start from the default
configuration like this:

```typescript
import { defineConfig } from 'oxfmt'

import config from '@plugjs/oxc/configs/oxfmt'

export default defineConfig({
  // OXFmt does not support an `extends` option, so spread the default config.
  ...config,
})
```

An OXLint configuration can import either the generic default configuration or
the Node.js-specific one:

```typescript
import { defineConfig } from 'oxlint'

import config from '@plugjs/oxc/configs/oxlint.node'

export default defineConfig({
  extends: [config],
})
```
