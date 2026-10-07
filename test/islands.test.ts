import { describe, expect, it } from 'vitest'
import { islandSrc } from '~/helpers/islands'
import { resultPath } from '~/helpers/search'

describe('islandSrc', () => {
  const manifest = { search: 'search-W49MC8l1.js' }

  it('points at the hashed file under /_islands/', () => {
    expect(islandSrc(manifest, 'search')).toBe('/_islands/search-W49MC8l1.js')
  })

  it('honours the app base URL', () => {
    expect(islandSrc(manifest, 'search', '/blog/')).toBe('/blog/_islands/search-W49MC8l1.js')
    expect(islandSrc(manifest, 'search', '/')).toBe('/_islands/search-W49MC8l1.js')
  })

  it('is undefined for an island the build did not produce', () => {
    expect(islandSrc(manifest, 'scene')).toBeUndefined()
    expect(islandSrc({}, 'search')).toBeUndefined()
    expect(islandSrc(manifest, 'toString')).toBeUndefined()
  })
})

describe('resultPath', () => {
  it('drops the trailing slash Pagefind adds', () => {
    expect(resultPath('/blog/a/')).toBe('/blog/a')
    expect(resultPath('/es/blog/guia-vue-composables/')).toBe('/es/blog/guia-vue-composables')
  })

  it('keeps the root, queries and anchors', () => {
    expect(resultPath('/')).toBe('/')
    expect(resultPath('/blog/a/?x=1#top')).toBe('/blog/a?x=1#top')
    expect(resultPath('/blog/a#top')).toBe('/blog/a#top')
  })
})
