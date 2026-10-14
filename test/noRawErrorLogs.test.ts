import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : path.endsWith('.ts') ? [path] : []
  })
}

// A log line that gets a caught error as it is carries the message of a failed request, and that message holds the URL with
// a reader's email or a token in its query (standard, section 4). Use `upstreamLogMessage(error)` (server/utils/upstreamError.ts)
describe('server logs', () => {
  it('never pass a caught error to console as it is', () => {
    const raw = /console\.(?:error|warn)\([^)]*,\s*(?:error|err|e)\s*\)/
    const found = files('server').filter(path => raw.test(readFileSync(path, 'utf8')))
    expect(found).toEqual([])
  })

  it('write only through the structured logger', () => {
    // server/utils/log.ts is the one file that writes to console (docs/security.md, "Logs")
    const found = files('server').filter(path => path !== join('server', 'utils', 'log.ts') && /(?<!\w)console\.\w+\(/.test(readFileSync(path, 'utf8')))
    expect(found).toEqual([])
  })
})
