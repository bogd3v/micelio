import { describe, it, expect } from 'vitest'
import { headerSection, isReadingPath, readingPercent, splitAroundNumber } from '~/helpers/header'

describe('headerSection', () => {
  it('maps routes to the active section in both locales', () => {
    expect(headerSection('/')).toBe('home')
    expect(headerSection('/es')).toBe('home')
    expect(headerSection('/es/')).toBe('home')
    expect(headerSection('/blog')).toBe('blog')
    expect(headerSection('/es/blog/mi-articulo')).toBe('blog')
    expect(headerSection('/about')).toBe('about')
    expect(headerSection('/es/about')).toBe('about')
  })

  it('returns undefined for pages outside the main navigation', () => {
    expect(headerSection('/newsletter/confirm')).toBeUndefined()
    expect(headerSection('/blogroll')).toBeUndefined()
    expect(headerSection('/estudio')).toBeUndefined()
  })
})

describe('isReadingPath', () => {
  it('is true only for a single article or draft', () => {
    expect(isReadingPath('/blog/vue-composables')).toBe(true)
    expect(isReadingPath('/es/blog/vue-composables')).toBe(true)
    expect(isReadingPath('/drafts/doc-draft')).toBe(true)
    expect(isReadingPath('/es/drafts/doc-draft')).toBe(true)
    expect(isReadingPath('/drafts')).toBe(false)
    expect(isReadingPath('/blog')).toBe(false)
    expect(isReadingPath('/es/blog/')).toBe(false)
    expect(isReadingPath('/about')).toBe(false)
  })
})

describe('readingPercent', () => {
  it('returns a rounded, clamped percentage', () => {
    expect(readingPercent(0, 3000, 1000)).toBe(0)
    expect(readingPercent(1000, 3000, 1000)).toBe(50)
    expect(readingPercent(2000, 3000, 1000)).toBe(100)
    expect(readingPercent(2500, 3000, 1000)).toBe(100)
    expect(readingPercent(333, 3000, 1000)).toBe(17)
  })

  it('returns 0 when the page does not scroll', () => {
    expect(readingPercent(0, 800, 1000)).toBe(0)
  })
})

describe('splitAroundNumber', () => {
  it('returns the text before and after the marker', () => {
    expect(splitAroundNumber('Read \u0001 %', '\u0001')).toEqual(['Read ', ' %'])
    expect(splitAroundNumber('\u0001 % leído', '\u0001')).toEqual(['', ' % leído'])
  })

  it('keeps the message when it has no marker', () => {
    expect(splitAroundNumber('Read', '\u0001')).toEqual(['Read', ''])
  })
})
