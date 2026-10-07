import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, inlineScripts } from '../app/helpers/securityHeaders'

describe('inlineScripts', () => {
  it('returns the content of executable inline scripts only', () => {
    const html = [
      '<script>window.a=1</script>',
      '<script type="module">import "x"</script>',
      '<script type="importmap">{"imports":{}}</script>',
      '<script src="/_nuxt/entry.js"></script>',
      '<script type="module" src="/_nuxt/app.js"></script>',
      '<script type="application/json" data-nuxt-data="nuxt-app">{"a":1}</script>',
      '<script type="application/ld+json">{"@type":"Blog"}</script>',
      '<script data-src="/x.js">window.b=2</script>',
    ].join('')
    expect(inlineScripts(html)).toEqual(['window.a=1', 'import "x"', '{"imports":{}}', 'window.b=2'])
  })

  it('keeps multi-line content exactly as written', () => {
    expect(inlineScripts('<script>\n  var a = 1;\n</script>')).toEqual(['\n  var a = 1;\n'])
  })
})

describe('contentSecurityPolicy', () => {
  const policy = contentSecurityPolicy({
    scriptHashes: ['abc=', 'abc=', 'def='],
    imageOrigins: ['https://api.bogdev.com.co/', 'https://resources.bogdev.com.co', 'not a url', ''],
  })
  const directives = new Map(policy.split('; ').map((directive) => {
    const [name = '', ...values] = directive.split(' ')
    return [name, values]
  }))

  it('allows scripts only from the site and the given hashes, without unsafe-inline', () => {
    expect(directives.get('script-src')).toEqual(['\'self\'', '\'sha256-abc=\'', '\'sha256-def=\''])
  })

  it('allows WebAssembly compilation only when asked (static search)', () => {
    expect(policy).not.toContain('wasm-unsafe-eval')
    const wasm = contentSecurityPolicy({ scriptHashes: ['abc='], imageOrigins: [], wasmEval: true })
    expect(wasm).toContain('script-src \'self\' \'wasm-unsafe-eval\' \'sha256-abc=\';')
    expect(wasm.replace(' \'wasm-unsafe-eval\'', '')).toBe(contentSecurityPolicy({ scriptHashes: ['abc='], imageOrigins: [] }))
  })

  it('allows images from the site and the media origins', () => {
    expect(directives.get('img-src')).toEqual(['\'self\'', 'data:', 'blob:', 'https://api.bogdev.com.co', 'https://resources.bogdev.com.co'])
  })

  it('allows videos from the site and the media origins, and nothing else', () => {
    expect(directives.get('media-src')).toEqual(['\'self\'', 'https://api.bogdev.com.co', 'https://resources.bogdev.com.co'])
  })

  it('blocks framing, plugins and foreign forms', () => {
    expect(directives.get('frame-ancestors')).toEqual(['\'none\''])
    expect(directives.get('object-src')).toEqual(['\'none\''])
    expect(directives.get('form-action')).toEqual(['\'self\''])
    expect(directives.get('base-uri')).toEqual(['\'self\''])
  })

  it('embeds only the video players the sanitizer allows', () => {
    expect(directives.get('frame-src')).toContain('https://www.youtube-nocookie.com')
    expect(directives.get('frame-src')).toContain('https://player.vimeo.com')
  })
})
