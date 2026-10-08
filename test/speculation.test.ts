import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import { speculationRules } from '../app/helpers/speculation'
import { contentSecurityPolicy, inlineScripts } from '../app/helpers/securityHeaders'
import { injectSpeculationRules, scriptHashDisagreements } from '../app/helpers/staticBuild'

interface Condition {
  and?: Condition[]
  not?: Condition
  href_matches?: string | string[]
  selector_matches?: string
}

function conditions(rules: ReturnType<typeof speculationRules>): Condition[] {
  return (rules.prefetch[0]!.where as Condition).and!
}

describe('speculationRules', () => {
  it('prerenders on hover and prefetches on touch', () => {
    const rules = speculationRules({ prerender: true })
    expect(rules.prerender).toHaveLength(1)
    expect(rules.prerender![0]!.eagerness).toBe('moderate')
    expect(rules.prefetch).toHaveLength(1)
    expect(rules.prefetch[0]!.eagerness).toBe('conservative')
  })

  it('only prefetches, on hover, when the site has Umami', () => {
    const rules = speculationRules({ prerender: false })
    expect(rules.prerender).toBeUndefined()
    expect(rules.prefetch).toEqual([expect.objectContaining({ eagerness: 'moderate' })])
    expect(JSON.stringify(rules)).not.toContain('prerender')
  })

  it('excludes routes with side effects and non-pages, with their /es/ versions', () => {
    const excluded = conditions(speculationRules({ prerender: true })).find(condition => condition.not?.href_matches)!.not!.href_matches as string[]
    for (const route of ['/api/*', '/account*', '/drafts*', '/newsletter/*', '/confirm*', '/_theme']) {
      expect(excluded, route).toContain(route)
      expect(excluded, `/es${route}`).toContain(`/es${route}`)
    }
    for (const file of ['/pagefind/*', '/_islands/*', '/_media/*', '/*.xml', '/robots.txt']) expect(excluded, file).toContain(file)
  })

  it('excludes links marked as downloads, nofollow or data-no-speculate', () => {
    const selector = conditions(speculationRules({ prerender: true })).find(condition => condition.not?.selector_matches)!.not!.selector_matches
    expect(selector).toBe('[download], [rel~=nofollow], [data-no-speculate]')
  })

  it('applies to internal links only', () => {
    expect(conditions(speculationRules({ prerender: true }))[0]).toEqual({ href_matches: '/*' })
  })

  it('puts the base URL in front of every pattern', () => {
    const [first, paths] = conditions(speculationRules({ baseURL: '/blog/', prerender: true }))
    expect(first).toEqual({ href_matches: '/blog/*' })
    for (const path of paths!.not!.href_matches as string[]) expect(path.startsWith('/blog/')).toBe(true)
  })

  it('does not depend on the page: the same rules every time, so one hash', () => {
    const render = (): string => JSON.stringify(speculationRules({ baseURL: '/', prerender: true }))
    expect(render()).toBe(render())
    expect(JSON.stringify(speculationRules({ prerender: true }))).toBe(render())
  })
})

describe('speculation rules and the CSP', () => {
  const json = JSON.stringify(speculationRules({ prerender: true }))
  const html = `<head><script type="speculationrules">${json}</script><script type="application/ld+json">{}</script></head>`

  it('hashes the script into script-src', () => {
    expect(inlineScripts(html)).toEqual([json])
    const hash = createHash('sha256').update(json).digest('base64')
    const policy = contentSecurityPolicy({ scriptHashes: inlineScripts(html).map(script => createHash('sha256').update(script).digest('base64')), imageOrigins: [] })
    expect(policy).toContain(`'sha256-${hash}'`)
  })

  it('is injected at the end of the head, identically in every page, so the hashes agree', () => {
    const rules = speculationRules({ prerender: true })
    const pages = new Map(['<html><head><title>a</title></head><body></body></html>', '<html><head></head><body>x</body></html>'].map((html, index) => [`/${index}`, inlineScripts(injectSpeculationRules(html, rules))]))
    expect([...pages.values()]).toEqual([[json], [json]])
    expect(scriptHashDisagreements(pages)).toEqual([])
    expect(injectSpeculationRules('<head><meta></head>', rules)).toBe(`<head><meta><script type="speculationrules">${json}</script></head>`)
  })

  it('does not inject twice', () => {
    const once = injectSpeculationRules('<head></head>', speculationRules({ prerender: true }))
    expect(injectSpeculationRules(once, speculationRules({ prerender: true }))).toBe(once)
  })

  it('refuses a page with no head', () => {
    expect(() => injectSpeculationRules('<body></body>', speculationRules({ prerender: true }))).toThrow('no </head>')
  })

  it('leaves out a script that is not a speculation or executable type', () => {
    expect(inlineScripts('<script type="speculation">{}</script>')).toEqual([])
  })
})
