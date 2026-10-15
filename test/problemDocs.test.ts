import { readFileSync } from 'node:fs'
import { beforeAll, describe, expect, it, vi } from 'vitest'
import { createError } from 'h3'

type ProblemModule = typeof import('../server/utils/problem')
let mod: ProblemModule

beforeAll(async () => {
  vi.stubGlobal('createError', createError)
  mod = await import('../server/utils/problem')
})

/** The rows of the "Error codes" table of `docs/api.md`: code and status. */
function documentedCodes(): Map<string, number> {
  const doc = readFileSync(new URL('../docs/api.md', import.meta.url), 'utf8')
  const section = /^## Error codes$([\s\S]*?)^## /m.exec(doc)?.[1] ?? ''
  return new Map([...section.matchAll(/^\| `(\w+)` \| (\d{3}) \|/gm)].map(match => [match[1]!, Number(match[2])]))
}

describe('docs/api.md error codes', () => {
  it('lists every code of the catalog with its status, and nothing else', () => {
    const documented = documentedCodes()
    const catalog = new Map(Object.entries(mod.PROBLEM_CODES).map(([code, entry]) => [code, entry.status]))
    expect([...documented].sort()).toEqual([...catalog].sort())
  })
})
