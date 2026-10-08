import { describe, expect, it } from 'vitest'
import { heavyDeclarationJson, islandSrc, parseHeavyDeclaration } from '~/helpers/islands'
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

  it('accepts only paths of this site', () => {
    for (const url of ['//evil.example/x', 'https://evil.example/', 'javascript:alert(1)', '/\\evil.example', 'blog/a', '', 'data:text/html,x']) {
      expect(resultPath(url), url).toBeUndefined()
    }
  })

  it('keeps the root, queries and anchors', () => {
    expect(resultPath('/')).toBe('/')
    expect(resultPath('/blog/a/?x=1#top')).toBe('/blog/a?x=1#top')
    expect(resultPath('/blog/a#top')).toBe('/blog/a#top')
  })
})

describe('heavy island declaration', () => {
  const declaration = { tag: 'micelio-mermaid', src: '/_islands/mermaid-BcWd6Buk.js' }

  it('round-trips through the JSON script, with the island\'s own settings beside it', () => {
    const json = heavyDeclarationJson(declaration, { label: 'Diagram' })
    expect(JSON.parse(json)).toEqual({ label: 'Diagram', ...declaration })
    expect(parseHeavyDeclaration(json)).toEqual(declaration)
  })

  it('escapes < so the text cannot close the script element', () => {
    expect(heavyDeclarationJson(declaration, { label: '</script><b>' })).not.toContain('<')
  })

  it('accepts the app base URL in front of the path', () => {
    expect(parseHeavyDeclaration('{"tag":"micelio-scene","src":"/blog/_islands/scene-1.js"}')).toEqual({ tag: 'micelio-scene', src: '/blog/_islands/scene-1.js' })
  })

  it('rejects anything but a file of /_islands/ and a micelio-* element', () => {
    for (const src of ['https://evil.example/_islands/a.js', '//evil.example/_islands/a.js', '/_nuxt/a.js', '/_islands/../a.js', '/_islands/a.css', 'javascript:alert(1)']) {
      expect(parseHeavyDeclaration(JSON.stringify({ tag: 'micelio-mermaid', src })), src).toBeUndefined()
    }
    expect(parseHeavyDeclaration(JSON.stringify({ tag: 'div', src: declaration.src }))).toBeUndefined()
  })

  it('is undefined for malformed text', () => {
    for (const text of [null, undefined, '', '{oops', 'null', '[]', '{"tag":1,"src":2}']) expect(parseHeavyDeclaration(text), String(text)).toBeUndefined()
  })
})
