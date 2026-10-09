import { describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { checkCss, checkThemeCss } from '../modules/theme/css-rules'
import { transform } from 'lightningcss'
import { loadHooks, parseHooks } from '../modules/theme/hooks'
import { REGION_VARIANTS } from '../modules/theme/layout/variants'

const hooks = loadHooks(join(process.cwd(), 'app'))

describe('theme CSS rules', () => {
  const ctx = { themeId: 'sample', themeDir: '/theme', hooks }
  const problems = (css: string): string[] => checkCss(css, 'theme.css', ctx).problems

  it('accepts public hooks, element selectors inside them, and the theme\'s own classes and attributes', () => {
    expect(problems('.myc-prose h2 { color: red } .myc-card:hover .myc-card-title { top: 0 } .sample-mark { top: 0 } [data-sample-open] { top: 0 }')).toEqual([])
    expect(problems('[data-theme="dia"] .myc-header[data-layout="bar"] { top: 0 } [data-scheme="dark"] .myc-seg[data-mode="a"] { top: 0 }')).toEqual([])
  })

  it('accepts the class states of a hook, not other myc-* classes', () => {
    expect(problems('.myc-section-plan-recommended { top: 0 } .myc-card.myc-card-featured { top: 0 }')).toEqual([])
    expect(problems('.myc-section-plan-nope { top: 0 }')).toHaveLength(1)
  })

  it('rejects an internal myc-* class anywhere in a selector, including :is(), :not(), nesting and at-rules', () => {
    for (const css of [
      '.myc-secret { top: 0 }',
      '.myc-header:is(.myc-secret) { top: 0 }',
      '.myc-header:not(.myc-secret) { top: 0 }',
      '.myc-header { .myc-secret { top: 0 } }',
      '@media (min-width: 10px) { .myc-secret { top: 0 } }',
      '@scope (.myc-header) to (.myc-secret) { a { top: 0 } }',
    ]) {
      expect(problems(css).join(), css).toContain('".myc-secret" is not a public hook')
    }
  })

  it('walks every nested selector list, including nth-child of, ::slotted() and :host()', () => {
    for (const css of [
      'li:nth-child(2n of .myc-secret) { top: 0 }',
      '.x::slotted(.myc-secret) { top: 0 }',
      ':host(.myc-secret) { top: 0 }',
      '.x:where(.myc-secret) { top: 0 }',
      '.x:has(> .myc-secret) { top: 0 }',
    ]) {
      expect(problems(css).join(), css).toContain('".myc-secret" is not a public hook')
    }
  })

  it('accepts :host without arguments instead of crashing', () => {
    expect(problems(':host { top: 0 }')).toEqual([])
  })

  it('names the new class for a selector written with the old bd- prefix', () => {
    expect(problems('.bd-card { top: 0 }')).toEqual(['theme.css: ".bd-card" was renamed ".myc-card" (ADR 0005, amendment of 2026-10-08)'])
    expect(problems('.bd-nothing { top: 0 }').join()).toContain('".bd-nothing" was renamed ".myc-nothing"; ".myc-nothing" is not a public hook either')
    expect(problems('.myc-header:is(.bd-seg) { top: 0 }').join()).toContain('".bd-seg" was renamed ".myc-seg"')
    expect(problems('[data-bd-lang] { top: 0 }')).toEqual(['theme.css: "[data-bd-lang]" was renamed "[data-myc-lang]" (ADR 0005, amendment of 2026-10-08)'])
    expect(problems('[class*="bd-card"] { top: 0 }').join()).toContain('were renamed from bd-* to myc-*')
  })

  it('flags a class attribute selector that matches myc- classes', () => {
    expect(problems('[class*="myc-card"] { top: 0 }').join()).toContain('matches internal myc-* classes')
    expect(problems('[class^=myc-] { top: 0 }').join()).toContain('matches internal myc-* classes')
    expect(problems('[class~="sample-mark"] { top: 0 }')).toEqual([])
  })

  it('lowercases attribute names before the data- check', () => {
    expect(problems('[DATA-MYC-COPY] { top: 0 }').join()).toContain('"[data-myc-copy]" is not a public hook')
    expect(problems('[DATA-LAYOUT="bar"] { top: 0 }')).toEqual([])
  })

  it('rejects a core data-* attribute that is not a hook', () => {
    expect(problems('[data-myc-copy] { top: 0 }').join()).toContain('"[data-myc-copy]" is not a public hook')
    expect(problems('.sample-x[data-other-theme-flag] { top: 0 }').join()).toContain('data-sample-')
  })

  it('rejects !important, also in custom properties and nested rules', () => {
    expect(problems('.x { color: red !important }').join()).toContain('!important on "color"')
    expect(problems('.x { --y: 1 !important }').join()).toContain('!important on "--y"')
    expect(problems('.x { &.y { top: 0 !important } }').join()).toContain('!important on "top"')
  })

  it('rejects remote and escaping @import', () => {
    expect(problems('@import "https://fonts.example/a.css";').join()).toContain('is remote')
    expect(problems('@import url(//cdn.example/a.css);').join()).toContain('is remote')
  })

  it('allows url() only into the theme\'s fonts and images', () => {
    expect(problems('@font-face { font-family: A; src: url("/fonts/a.woff2") } .x { background: url(/theme/images/a.jpg) }')).toEqual([])
    for (const url of ['https://x.test/a.png', '/other/a.png', '//x.test/a.png', 'data:image/png;base64,AAAA', '../a.png']) {
      expect(problems(`.x { background: url("${url}") }`).join(), url).toContain('is outside the theme')
    }
    expect(problems('.x { background-image: image-set(url(https://x.test/a.png) 1x) }').join()).toContain('is outside the theme')
    expect(problems('.x { --bg: url(https://x.test/a.png) }').join()).toContain('is outside the theme')
  })

  it('finds URLs in image-set() and src(), in declarations and custom properties', () => {
    for (const css of [
      '.x { background: image-set("https://x.test/a.png" 1x) }',
      '.x { --y: image-set("https://x.test/a.png" 1x) }',
      '.x { background: src("https://x.test/a.png") }',
      '.x { --y: src("https://x.test/a.png") }',
      '.x { --y: -webkit-image-set(url(https://x.test/a.png) 1x) }',
    ]) {
      expect(problems(css).join(), css).toContain('is outside the theme')
    }
    expect(problems('.x { background: image-set("/theme/images/a.png" 1x) }')).toEqual([])
  })

  it('walks the initial-value of @property', () => {
    expect(problems('@property --a { syntax: "<image>"; inherits: false; initial-value: url(https://x.test/a.png) }').join()).toContain('is outside the theme')
  })

  it('rejects dot segments, backslashes and encoded dots in url() paths', () => {
    for (const url of ['/theme/images/../secret.png', '/fonts/../x.png', '/theme/images/%2e%2e/x.png', '/theme/images/%2E./x.png', '/fonts/%252e%252e/x', '/theme/images/a%5cb.png', '/theme/images/%2fx']) {
      expect(problems(`.x { background: url("${url}") }`).join(), url).toContain('is outside the theme')
    }
    expect(problems('.x { background: url("/theme/images/hero/a%20b.jpg") }')).toEqual([])
  })

  it('reports CSS that does not parse', () => {
    expect(problems('.x { color: red; } }')[0]).toMatch(/^theme\.css: cannot parse the CSS/)
  })
})

describe('theme CSS files', () => {
  it('rejects a symlinked stylesheet, even when it points inside the theme', () => {
    const dir = mkdtempSync(join(tmpdir(), 'myc-css-'))
    mkdirSync(join(dir, 'slots'))
    writeFileSync(join(dir, 'real.css'), '.sample-x { top: 0 }')
    symlinkSync(join(dir, 'real.css'), join(dir, 'theme.css'))
    writeFileSync(join(dir, 'slots', 'mark.css'), '.sample-y { top: 0 }')
    expect(checkThemeCss({ themeId: 'sample', themeDir: dir, hooks })).toEqual(['theme.css is a symlink; copy the file instead'])
  })

  it('rejects a symlink to a file outside the theme', () => {
    const dir = mkdtempSync(join(tmpdir(), 'myc-css-'))
    const outside = mkdtempSync(join(tmpdir(), 'myc-outside-'))
    writeFileSync(join(outside, 'x.css'), '.sample-x { top: 0 }')
    symlinkSync(join(outside, 'x.css'), join(dir, 'theme.css'))
    expect(checkThemeCss({ themeId: 'sample', themeDir: dir, hooks })).toEqual(['theme.css is a symlink; copy the file instead'])
  })

  it('rejects an @import that goes through a symlinked folder', () => {
    const dir = mkdtempSync(join(tmpdir(), 'myc-css-'))
    const outside = mkdtempSync(join(tmpdir(), 'myc-outside-'))
    writeFileSync(join(outside, 'x.css'), '.sample-x { top: 0 }')
    symlinkSync(outside, join(dir, 'lib'))
    writeFileSync(join(dir, 'theme.css'), '@import "./lib/x.css";')
    expect(checkThemeCss({ themeId: 'sample', themeDir: dir, hooks })).toEqual(['lib/x.css resolves outside the theme folder'])
  })
})

describe('hooks.json', () => {
  it('parses and lists the hooks Bogota uses', () => {
    expect(hooks.classes.has('myc-foot')).toBe(true)
    expect(hooks.classes.has('myc-hero-art')).toBe(true)
    expect(hooks.attributes.has('data-layout')).toBe(true)
  })

  it('rejects a malformed list', () => {
    expect(() => parseHooks({ contract: 1, attributes: {}, classes: { 'not-bd': 'x' } })).toThrow()
    expect(() => parseHooks({ contract: 2, attributes: {}, classes: {} })).toThrow()
  })

  it('names only classes the core uses', () => {
    const sources = ['app/assets/css', 'app/components', 'app/pages', 'app/layouts', 'app/theme', 'app/composables', 'themes/bogota']
    const text = sources.map(dir => readTree(join(process.cwd(), dir))).join('\n')
    const unused = [...hooks.classes].filter(name => !new RegExp(`${name}(?![\\w-])`).test(text))
    expect(unused).toEqual([])
  })

  it('declares the section catalog: every section in data-section and its variants in data-variant', () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'app/theme/hooks.json'), 'utf8')) as { attributes: Record<string, { values: string[] }> }
    const variants = Object.fromEntries(raw.attributes['data-variant']!.values.map((entry) => {
      const [section, list] = entry.split(': ')
      return [section, list!.split(', ')]
    }))
    expect(raw.attributes['data-section']!.values.filter(id => id !== 'rich-text').sort()).toEqual(Object.keys(variants).sort())
    expect(variants['hero']).toEqual(['centered', 'split', 'full-bleed'])
    expect(Object.values(variants).flat()).toHaveLength(29)
  })

  it('accepts the section hooks in theme CSS', () => {
    const ctx = { themeId: 'sample', themeDir: '/theme', hooks }
    const problems = (css: string): string[] => checkCss(css, 'theme.css', ctx).problems
    expect(problems('.myc-section[data-section="hero"][data-variant="split"] .myc-section-title { top: 0 }')).toEqual([])
  })

  it('names only variants the core implements in every layouts entry and in data-layout', () => {
    const raw = JSON.parse(readFileSync(join(process.cwd(), 'app/theme/hooks.json'), 'utf8')) as {
      attributes: Record<string, { values?: string[] }>
      classes: Record<string, string | { layouts?: Record<string, string[]> }>
    }
    const unknown: string[] = []
    for (const [name, hook] of Object.entries(raw.classes)) {
      if (typeof hook === 'string') continue
      for (const [region, variants] of Object.entries(hook.layouts ?? {})) {
        const implemented = (REGION_VARIANTS as Record<string, { variants: string[] }>)[region]?.variants
        for (const variant of variants) if (!implemented?.includes(variant)) unknown.push(`${name}: ${region}/${variant}`)
      }
    }
    expect(unknown).toEqual([])
    const implemented = Object.values(REGION_VARIANTS).flatMap(entry => entry.variants)
    expect([...raw.attributes['data-layout']!.values!].sort()).toEqual([...new Set(implemented)].sort())
  })
})

describe('layout variant CSS', () => {
  // Every variant sits in the same layer on the page; only the one in use may style it (ADR 0005, section 5)
  const base = join(process.cwd(), 'app/theme/layout')
  const scoped = ['header', 'home', 'postList', 'article', 'footer'] as const
  const files = scoped.flatMap(region => REGION_VARIANTS[region].variants.map(variant => ({ region, variant, file: join(base, region, `${variant}.css`) })))

  it.each(files)('$region/$variant.css scopes every selector by its data-layout, except :root and html', ({ variant, file }) => {
    const css = readFileSync(file, 'utf8')
    const unscoped: string[] = []
    transform({
      filename: file,
      code: Buffer.from(css),
      visitor: {
        Rule: {
          style(rule) {
            for (const selector of rule.value.selectors) {
              const text = JSON.stringify(selector)
              const rootOnly = selector.every(part => part.type === 'pseudo-class' && part.kind === 'root') || (selector[0]?.type === 'type' && selector[0].name === 'html')
              const scoped = text.includes(`"name":"data-layout"`) && text.includes(`"value":"${variant}"`)
              if (!rootOnly && !scoped) unscoped.push(text.slice(0, 80))
            }
            return undefined
          },
        },
      },
    })
    expect(unscoped).toEqual([])
    expect(css.length).toBeGreaterThan(0)
  })
})

function readTree(path: string): string {
  if (!statSync(path).isDirectory()) return readFileSync(path, 'utf8')
  return readdirSync(path).map(name => readTree(join(path, name))).join('\n')
}
