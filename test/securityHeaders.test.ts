import { describe, expect, it } from 'vitest'
import { contentSecurityPolicy, cspOrigin, inlineScripts, islandPolicyOptions, islandsInHtml, isWorkerScriptPath, runtimesSource, workerPolicy } from '../app/helpers/securityHeaders'
import { HEAVY_ISLANDS } from '../app/islands/heavy'
import type { HeavyIsland } from '../app/islands/heavy'

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

describe('cspOrigin', () => {
  it('keeps plain origins as URL.origin gives them', () => {
    for (const url of ['https://api.bogdev.com.co/x', 'http://localhost:1337/', 'http://127.0.0.1:4310', 'http://strapi:1337/up']) expect(cspOrigin(url)).toBe(new URL(url).origin)
  })

  it('drops hosts that change the policy and a trailing dot', () => {
    for (const url of ['https://*/x', 'https://*.x.com/', 'https://a.com%2a/', 'https://a;b.com/', 'ftp://x.com/', 'nope', '']) expect(cspOrigin(url), url).toBe('')
    expect(cspOrigin('https://a.com./x')).toBe('https://a.com')
  })
})

describe('contentSecurityPolicy formOrigins', () => {
  const base = { scriptHashes: [], imageOrigins: [] }
  const formAction = (options: Partial<Parameters<typeof contentSecurityPolicy>[0]> = {}): string | undefined =>
    contentSecurityPolicy({ ...base, ...options }).split('; ').find(directive => directive.startsWith('form-action'))

  it('keeps form-action on self by default, byte-identical to before', () => {
    expect(formAction()).toBe('form-action \'self\'')
    expect(contentSecurityPolicy({ ...base, formOrigins: [] })).toBe(contentSecurityPolicy(base))
  })

  it('adds origins only, deduplicated, and drops what is not a URL', () => {
    const origins = ['https://buttondown.com/api/emails/embed-subscribe/x', 'https://buttondown.com', 'nope', '']
    expect(formAction({ formOrigins: origins })).toBe('form-action \'self\' https://buttondown.com')
    expect(contentSecurityPolicy({ ...base, meta: true, formOrigins: origins })).toContain('form-action \'self\' https://buttondown.com;')
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

describe('heavy island additions', () => {
  const base = { scriptHashes: ['abc='], imageOrigins: [] }
  const playground = HEAVY_ISLANDS.find(island => island.id === 'playground') as HeavyIsland

  it('adds nothing for a page without islands: the policy is byte-identical', () => {
    expect(contentSecurityPolicy({ ...base, ...islandPolicyOptions([]) })).toBe(contentSecurityPolicy(base))
  })

  it('gives a playground page worker-src and nothing else: only the Worker compiles WebAssembly', () => {
    const policy = contentSecurityPolicy({ ...base, ...islandPolicyOptions([playground]) })
    expect(policy).toContain('script-src \'self\' \'sha256-abc=\';')
    expect(policy).not.toContain('wasm-unsafe-eval')
    expect(policy).toContain('worker-src \'self\';')
    expect(policy.replace(' worker-src \'self\';', '')).toBe(contentSecurityPolicy(base))
    expect(islandPolicyOptions([playground]).wasmEval).toBe(false)
  })

  it('adds connect-src sources after self, without repeating it', () => {
    const policy = contentSecurityPolicy({ ...base, connectSources: ['\'self\'', 'https://models.example.com/glb/'] })
    expect(policy).toContain('connect-src \'self\' https://models.example.com/glb/;')
  })

  it('finds the islands a page renders', () => {
    expect(islandsInHtml('<main><micelio-playground data-src="/_islands/playground-x.js" class="a"><figure>', HEAVY_ISLANDS).map(island => island.id)).toEqual(['playground'])
    expect(islandsInHtml('<micelio-playground>', HEAVY_ISLANDS)).toHaveLength(1)
    expect(islandsInHtml('<micelio-search data-pagefind-ignore><p>&lt;micelio-playground&gt;</p><micelio-playgrounds>', HEAVY_ISLANDS)).toEqual([])
  })
})

describe('Worker policy', () => {
  it('limits connect-src to the runtimes folder of the site, as an origin and a path', () => {
    expect(runtimesSource('https://bogdev.com.co')).toBe('https://bogdev.com.co/_islands/runtimes/')
    expect(runtimesSource('https://bogdev.com.co/', '/blog/')).toBe('https://bogdev.com.co/blog/_islands/runtimes/')
    expect(runtimesSource('http://127.0.0.1:3000')).toBe('http://127.0.0.1:3000/_islands/runtimes/')
  })

  it('has no policy when the site URL is unset or could change it: never a fallback to self', () => {
    for (const url of ['', 'not a url', 'https://*.example.com', 'https://a.com;b', 'javascript:alert(1)']) {
      expect(runtimesSource(url), url).toBeUndefined()
      expect(workerPolicy(url), url).toBeUndefined()
    }
  })

  it('denies everything but scripts of the site, WebAssembly and the runtimes folder', () => {
    expect(workerPolicy('https://bogdev.com.co')).toBe('default-src \'none\'; script-src \'self\' \'wasm-unsafe-eval\'; connect-src https://bogdev.com.co/_islands/runtimes/')
    expect(workerPolicy('https://bogdev.com.co')).not.toContain('unsafe-inline')
    expect(workerPolicy('https://bogdev.com.co')).not.toContain(' \'unsafe-eval\'')
  })
})

describe('isWorkerScriptPath', () => {
  it('matches the Worker folder however the path is written', () => {
    for (const path of ['/_islands/workers/playground-x.js', '/_islands/%77orkers/playground-x.js', '/_islands/workers/p.js?x=1', '//_islands/workers/p.js', '/_islands/./workers/p.js', '/_islands/a/../workers/p.js', '/_islands/%2e/workers/p.js', '/_islands/%ZZworkers/p.js']) {
      expect(isWorkerScriptPath(path), path).toBe(true)
    }
  })

  it('leaves the other files alone, and honours the base URL', () => {
    for (const path of ['/', '/_islands/loader-x.js', '/_islands/runtimes/sql-x.js', '/blog/_islands/workers/p.js', '/_nuxt/workers/p.js']) expect(isWorkerScriptPath(path), path).toBe(false)
    expect(isWorkerScriptPath('/blog/_islands/workers/p.js', '/blog/')).toBe(true)
    expect(isWorkerScriptPath('/_islands/workers/p.js', '/blog/')).toBe(false)
  })
})
