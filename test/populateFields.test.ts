import { describe, expect, it } from 'vitest'
import { FEED_POPULATE, PAGE_POPULATE, SITE_POPULATE } from '../server/lib/constants'

// Relations of the frontend queries that are files; a bare `true` would return the whole row (hash, provider, formats…)
const MEDIA_KEYS = new Set(['media', 'icon', 'image', 'avatar', 'images', 'model', 'poster', 'metaImage', 'logo', 'favicon', 'defaultOgImage', 'cover'])

/** The paths where a media relation is populated without naming its `fields`. */
function unnamedMedia(node: unknown, path = ''): string[] {
  if (typeof node !== 'object' || node === null) return []
  return Object.entries(node).flatMap(([key, value]) => {
    const here = path ? `${path}.${key}` : key
    if (MEDIA_KEYS.has(key) && (value === true || value === '*')) return [here]
    if (MEDIA_KEYS.has(key) && typeof value === 'object' && value !== null && !('fields' in value)) return [here]
    return unnamedMedia(value, here)
  })
}

describe('the media of the page, site and feed queries', () => {
  it('name their fields, so a new CMS field or a file row never widens the response', () => {
    expect(unnamedMedia(PAGE_POPULATE, 'page')).toEqual([])
    expect(unnamedMedia(SITE_POPULATE, 'site')).toEqual([])
    expect(unnamedMedia(FEED_POPULATE, 'feed')).toEqual([])
  })

  it('notice a media populated whole', () => {
    expect(unnamedMedia({ sections: { on: { hero: { populate: { media: true, poster: { fields: ['url'] } } } } } })).toEqual(['sections.on.hero.populate.media'])
  })

  it('ask the feed for the cover URL and the category name only', () => {
    expect(FEED_POPULATE).toEqual({ cover: { fields: ['url'] }, category: { fields: ['name'] } })
  })
})
