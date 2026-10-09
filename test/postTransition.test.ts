import { describe, expect, it } from 'vitest'
import { postTransitionNames } from '../app/helpers/postTransition'

const IDENT = /^-?[_a-zA-Z][_a-zA-Z0-9-]*$/

describe('postTransitionNames', () => {
  it('returns valid CSS idents with the bd-post- prefix', () => {
    for (const slug of ['hello-world', '2024-recap', 'año nuevo', 'a/b?c=d', 'emoji-🍄', '', 'x_y']) {
      const { media, title } = postTransitionNames(slug)
      expect(media).toMatch(IDENT)
      expect(title).toMatch(IDENT)
      expect(media.startsWith('bd-post-')).toBe(true)
      expect(title.startsWith('bd-post-')).toBe(true)
    }
  })

  it('is stable and distinct for the media and the title', () => {
    expect(postTransitionNames('a-post')).toEqual(postTransitionNames('a-post'))
    const { media, title } = postTransitionNames('a-post')
    expect(media).not.toBe(title)
  })

  it('never collides for different slugs', () => {
    const slugs = ['a_b', 'a-b', 'a b', 'a_20_b', 'ab', 'á']
    const names = slugs.map(slug => postTransitionNames(slug).media)
    expect(new Set(names).size).toBe(slugs.length)
  })
})
