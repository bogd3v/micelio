import { describe, expect, it } from 'vitest'
import { toQueryString } from '../app/helpers/query'

describe('toQueryString', () => {
  it('keeps the order of the keys', () => {
    expect(toQueryString({ page: 2, pageSize: 6, locale: 'es' })).toBe('page=2&pageSize=6&locale=es')
  })

  it('skips undefined and null values', () => {
    expect(toQueryString({ page: 1, category: undefined, tag: null, locale: 'en' })).toBe('page=1&locale=en')
  })

  it('returns an empty string when nothing is set', () => {
    expect(toQueryString({ locale: undefined })).toBe('')
  })

  it('encodes spaces and reserved characters', () => {
    expect(toQueryString({ search: 'vue & nuxt/3?' })).toBe('search=vue+%26+nuxt%2F3%3F')
  })

  it('writes booleans and numbers as text', () => {
    expect(toQueryString({ content: true, page: 0 })).toBe('content=true&page=0')
  })
})
