import { readFileSync } from 'node:fs'
import { describe, it, expect } from 'vitest'

const css = readFileSync('app/assets/css/components/chip.css', 'utf8')

describe('chip current state', () => {
  it('styles [aria-current] like [aria-pressed], also in forced colors', () => {
    const selector = /\.bd-chip\[aria-pressed="true"\],\s*\.bd-chip\[aria-current\]\s*\{/g
    expect(css.match(selector)).toHaveLength(2)
  })
})
