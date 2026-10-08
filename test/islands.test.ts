import { describe, expect, it } from 'vitest'
import { heavyDeclarationJson, heavyTag, islandSrc, parseHeavyDeclaration } from '~/helpers/islands'
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
  const declaration = { id: 'mermaid', trigger: 'visible' as const, saveData: 'load' as const, src: '/_islands/mermaid-BcWd6Buk.js', features: [] }
  const play = { id: 'play', trigger: 'interaction' as const, saveData: 'skip' as const, src: '/_islands/play-1.js', features: ['wasm', 'worker'], control: '[data-play-run]' }

  it('derives the element from the id', () => {
    expect(heavyTag('mermaid')).toBe('micelio-mermaid')
  })

  it('round-trips through the JSON script, with the island own settings beside it', () => {
    const json = heavyDeclarationJson(declaration, { label: 'Diagram' })
    expect(JSON.parse(json)).toEqual({ label: 'Diagram', ...declaration })
    expect(parseHeavyDeclaration(json)).toEqual(declaration)
    expect(parseHeavyDeclaration(heavyDeclarationJson(play))).toEqual(play)
  })

  it('escapes < so the text cannot close the script element', () => {
    expect(heavyDeclarationJson(declaration, { label: '</script><b>' })).not.toContain('<')
  })

  it('accepts the app base URL in front of the path', () => {
    expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, id: 'scene', src: '/blog/_islands/scene-1.js' }))?.src).toBe('/blog/_islands/scene-1.js')
  })

  it('skips on Save-Data unless the island says load', () => {
    expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, saveData: undefined }))?.saveData).toBe('skip')
    expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, motion: true }))?.motion).toBe(true)
    expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, motion: 'yes' }))?.motion).toBeUndefined()
    expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, saveData: 'always' }))?.saveData).toBe('skip')
  })

  it('needs a data-attribute control for an interaction island, and only keeps well-formed features', () => {
    for (const control of [undefined, 'button.evil', '#run', '[data-x] a', '']) expect(parseHeavyDeclaration(JSON.stringify({ ...play, control })), String(control)).toBeUndefined()
    expect(parseHeavyDeclaration(JSON.stringify({ ...play, features: ['wasm', 3, 'bad feature'] }))?.features).toEqual(['wasm'])
    expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, control: '[data-x]' }))?.control).toBeUndefined()
  })

  it('rejects anything but a file of /_islands/ and a plain island id', () => {
    for (const src of ['https://evil.example/_islands/a.js', '//evil.example/_islands/a.js', '/_nuxt/a.js', '/_islands/../a.js', '/_islands/a.css', 'javascript:alert(1)']) {
      expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, src })), src).toBeUndefined()
    }
    for (const id of ['Div', 'a b', '', 'x"y']) expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, id })), id).toBeUndefined()
    expect(parseHeavyDeclaration(JSON.stringify({ ...declaration, trigger: 'hover' }))).toBeUndefined()
  })

  it('is undefined for malformed text', () => {
    for (const text of [null, undefined, '', '{oops', 'null', '[]', '{"id":1,"src":2}']) expect(parseHeavyDeclaration(text), String(text)).toBeUndefined()
  })
})
