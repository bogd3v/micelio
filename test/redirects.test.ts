import { describe, expect, it } from 'vitest'
import { redirectsFile, redirectTarget, REDIRECTS_MAX_RULES, resolveRedirects } from '~/helpers/redirects'

const row = (from: string, to: string, locale: string | null = 'en') => ({ from, to, locale })

describe('resolveRedirects', () => {
  it('prefixes a Spanish row and applies a row with no locale to every locale', () => {
    const { paths, dropped } = resolveRedirects([row('/a', '/b'), row('/c', '/d', 'es'), row('/e', '/f', null)])
    expect(Object.fromEntries(paths)).toEqual({ '/a': '/b', '/es/c': '/es/d', '/e': '/f', '/es/e': '/es/f' })
    expect(dropped).toEqual([])
  })

  it('resolves a chain to its end, whatever the order of the rows', () => {
    const { paths } = resolveRedirects([row('/c', '/d'), row('/a', '/b'), row('/b', '/c')])
    expect(Object.fromEntries(paths)).toEqual({ '/a': '/d', '/b': '/d', '/c': '/d' })
  })

  it('drops a cycle, a redirect to itself and what leads into a cycle, and keeps the rest', () => {
    const { paths, dropped } = resolveRedirects([row('/a', '/b'), row('/b', '/a'), row('/self', '/self'), row('/in', '/a'), row('/ok', '/fine')])
    expect(Object.fromEntries(paths)).toEqual({ '/ok': '/fine' })
    expect(dropped.sort()).toEqual([
      '/a to /b: part of a redirect cycle',
      '/b to /a: part of a redirect cycle',
      '/in to /a: part of a redirect cycle',
      '/self to /self: part of a redirect cycle',
    ])
  })

  it('keeps a cycle in one locale from dropping the same paths in the other', () => {
    const { paths } = resolveRedirects([row('/a', '/b', 'en'), row('/b', '/a', 'en'), row('/a', '/c', 'es')])
    expect(Object.fromEntries(paths)).toEqual({ '/es/a': '/es/c' })
  })

  it.each(['https://evil.example/x', '//evil.example', '/\\evil.example', 'relative', '/with space', '/a\nb'])('drops a target that leaves the site: %j', (to) => {
    const { paths, dropped } = resolveRedirects([row('/a', to)])
    expect(paths.size).toBe(0)
    expect(dropped).toEqual([`/a to ${to}: not a path of the site`])
  })

  it('drops a source that a _redirects file would read as a pattern, and a locale the site does not serve', () => {
    const { paths, dropped } = resolveRedirects([row('/*', '/b'), row('/:slug', '/b'), row('/a', '/b', 'fr')])
    expect(paths.size).toBe(0)
    expect(dropped).toHaveLength(3)
  })
})

describe('redirectTarget', () => {
  const { paths } = resolveRedirects([row('/a', '/b'), row('/', '/home')])
  it('finds a path with or without a trailing slash, and the root', () => {
    expect(redirectTarget(paths, '/a')).toBe('/b')
    expect(redirectTarget(paths, '/a/')).toBe('/b')
    expect(redirectTarget(paths, '/')).toBe('/home')
    expect(redirectTarget(paths, '/other')).toBeUndefined()
  })
})

describe('redirectsFile', () => {
  it('writes one 301 line per redirect in path order', () => {
    expect(redirectsFile(new Map([['/b', '/c'], ['/a', '/c']]))).toBe('/a /c 301\n/b /c 301\n')
  })

  it('throws over the limit of the host', () => {
    const many = new Map(Array.from({ length: REDIRECTS_MAX_RULES + 1 }, (_, index) => [`/from-${index}`, '/to'] as const))
    expect(() => redirectsFile(many)).toThrow('2000')
  })
})
