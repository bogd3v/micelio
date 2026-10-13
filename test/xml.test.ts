import { describe, it, expect } from 'vitest'
import { escapeXml } from '../app/helpers/xml'

describe('escapeXml', () => {
  it('escapes the characters that end a text node or an attribute', () => {
    expect(escapeXml(`a&b<c>d"e'f`)).toBe('a&amp;b&lt;c&gt;d&quot;e&apos;f')
  })

  it('escapes an ampersand first, so an entity is not escaped twice by its own output', () => {
    expect(escapeXml('&lt;')).toBe('&amp;lt;')
  })

  it('leaves plain text and non-ASCII characters alone', () => {
    expect(escapeXml('Café ñ 日本')).toBe('Café ñ 日本')
  })
})
