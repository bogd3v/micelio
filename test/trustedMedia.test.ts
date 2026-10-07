import { describe, expect, it } from 'vitest'
import { isTrustedMedia } from '../app/helpers/trustedMedia'

describe('isTrustedMedia', () => {
  const prefix = '/_theme/media/'

  it('accepts a file directly under the prefix', () => {
    expect(isTrustedMedia('/_theme/media/hero.svg', prefix)).toBe(true)
  })

  it('accepts nothing without a provided prefix (every server-parsed page)', () => {
    expect(isTrustedMedia('/_theme/media/hero.svg', undefined)).toBe(false)
    expect(isTrustedMedia('/uploads/a.png', undefined)).toBe(false)
  })

  it('rejects traversal (also percent-encoded), nesting, queries, other paths and a malformed prefix', () => {
    for (const url of ['/_theme/media/../x.svg', '/_theme/media/a/b.svg', '/_theme/media/a.svg?x=1', '/_theme/media/%2e%2e%2fx.svg', '/_theme/other/a.svg', '/_theme/media/\\a.svg', '//evil.test/_theme/media/a.svg', 'https://evil.test/_theme/media/a.svg']) {
      expect(isTrustedMedia(url, prefix), url).toBe(false)
    }
    expect(isTrustedMedia('//x', 'https://evil.test/')).toBe(false)
  })
})
