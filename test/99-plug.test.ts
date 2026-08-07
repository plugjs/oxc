// oxlint-disable typescript/unbound-method
import { merge } from '@plugjs/plug'

describe('TypeScript Plug installation', () => {
  it('should install the "oxc", "oxfmt" and "oxlint" plugs', async () => {
    // Initially, no plugs shoult be installed...
    expect(merge([]).oxc).toBeUndefined()
    expect(merge([]).oxfmt).toBeUndefined()
    expect(merge([]).oxlint).toBeUndefined()

    // Then we import the index file (installing the plugs)
    await import('../src/index.ts')

    // The plugs should now be installed
    expect(merge([]).oxc).toBeA('function')
    expect(merge([]).oxfmt).toBeA('function')
    expect(merge([]).oxlint).toBeA('function')
  })
})
