import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

// REUSE needs the exception's text in LICENSES/; LICENSE-EXCEPTION.md stays the file people link to (ADR 0007, amendment of 2026-10-08)
describe('REUSE license texts', () => {
  it('keeps the theme exception in LICENSES/ equal to LICENSE-EXCEPTION.md', () => {
    const copy = readFileSync('LICENSES/LicenseRef-Micelio-Theme-exception.txt', 'utf8')
    expect(copy).toBe(readFileSync('LICENSE-EXCEPTION.md', 'utf8'))
  })
})
