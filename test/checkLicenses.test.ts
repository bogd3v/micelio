import { describe, expect, it } from 'vitest'
import { evaluate } from '../scripts/check-licenses.mjs'

describe('check-licenses evaluate', () => {
  it.each([
    'MIT', 'Apache-2.0', '(MIT OR Apache-2.0)', '(BSD-3-Clause OR GPL-2.0)', 'Apache-2.0 AND LGPL-3.0-or-later',
    'GPL-3.0-only', 'AGPL-3.0-or-later', 'GPL-2.0-or-later', 'GPL-2.0+', 'Apache-2.0 WITH LLVM-exception',
    '(MPL-2.0 OR Apache-2.0)',
  ])('allows %s', (expr) => {
    expect(evaluate(expr)).toBe(true)
  })

  it.each([
    'GPL-2.0-only', 'GPL-2.0', 'EPL-2.0', 'UNLICENSED', 'SEE LICENSE IN LICENSE.md', 'MIT AND EPL-2.0',
    'MIT GPL-2.0-only', '(MIT', 'MIT)', 'MIT WITH', 'MIT OR', 'AND MIT', '',
  ])('rejects %j', (expr) => {
    expect(evaluate(expr)).toBe(false)
  })
})
