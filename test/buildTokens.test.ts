import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildTokensCss } from '../modules/theme/tokens.mjs'
import type { ThemeData } from '../modules/theme/tokens.mjs'

const SCRIPT = join(process.cwd(), 'scripts/build-tokens.mjs')
const BOGOTA = 'themes/bogota/theme.json'

const fixture: ThemeData = {
  modes: [{ id: 'noche', scheme: 'dark' }, { id: 'dia', scheme: 'light' }],
  color: {
    tokens: [
      { name: 'surface', value: { noche: '#000000', dia: '#ffffff' } },
      { name: 'chillon', value: { noche: '#2ee6b6', dia: '#0a6656' } },
      { name: 'focus', value: '{chillon}' },
    ],
  },
  shadow: { tokens: [{ name: 'glow', value: { noche: '0 0 1px red', dia: 'none' } }] },
  spacing: { tokens: [
    { name: 'space-1', value: '4px' },
    { name: 'space-section', value: '{space-1}' },
    { name: 'space-inline', value: '20px', at: { '768px': 'max(24px, 5vw)' } },
  ] },
  radius: { tokens: [{ name: 'radius-none', value: '0' }] },
  size: { tokens: [{ name: 'measure', value: '68ch' }] },
  motion: { tokens: [{ name: 'duration-base', value: '240ms' }, { name: 'ease-standard', value: 'cubic-bezier(0.2, 0, 0, 1)' }] },
  type: {
    families: { mono: '"JetBrains Mono", monospace' },
    groups: [{ family: 'mono', styles: [
      { name: 'meta', fontSize: '13px', lineHeight: '20px', fontWeight: 400 },
      { name: 'eyebrow', fontSize: '12px', lineHeight: '16px', fontWeight: 500, letterSpacing: '0.16em' },
    ] }],
  },
}

function block(css: string, selector: string): string {
  const start = css.indexOf(selector)
  return css.slice(start, css.indexOf('}', start))
}

describe('buildTokensCss', () => {
  const css = buildTokensCss(fixture, { noche: ['.dark'], dia: ['.light'] })

  it('writes each mode with its own values, the first one also on :root', () => {
    expect(css).toContain(':root,\n[data-theme="noche"],\n.dark {')
    expect(block(css, '[data-theme="noche"]')).toContain('--surface: #000000;')
    expect(block(css, '[data-theme="noche"]')).toContain('color-scheme: dark;')
    expect(css).toContain('[data-theme="dia"],\n.light {')
    expect(block(css, '[data-theme="dia"]')).toContain('--surface: #ffffff;')
    expect(block(css, '[data-theme="dia"]')).toContain('color-scheme: light;')
  })

  it('remaps muted ink and lines under prefers-contrast: more for every mode, after the mode blocks', () => {
    const start = css.indexOf('@media (prefers-contrast: more)')
    expect(start).toBeGreaterThan(css.lastIndexOf('color-scheme:'))
    const media = css.slice(start, css.indexOf('\n}\n', start))
    for (const selector of [':root', '[data-theme="noche"]', '.dark', '[data-theme="dia"]', '.light']) expect(media).toContain(selector)
    expect(media).toContain('--ink-muted: var(--ink);')
    expect(media).toContain('--line: var(--line-strong);')
  })

  it('takes color-scheme from the mode, not from its id', () => {
    const out = buildTokensCss({ ...fixture, modes: [{ id: 'tarde', scheme: 'light' }, { id: 'noche', scheme: 'dark' }] })
    expect(block(out, '[data-theme="tarde"]')).toContain('color-scheme: light;')
    expect(block(out, '[data-theme="noche"]')).toContain('color-scheme: dark;')
  })

  it('resolves aliases to CSS variables', () => {
    expect(block(css, '[data-theme="noche"]')).toContain('--focus: var(--chillon);')
    expect(block(css, '[data-theme="dia"]')).toContain('--focus: var(--chillon);')
  })

  it('writes themed shadows and single-value tokens', () => {
    expect(block(css, '[data-theme="dia"]')).toContain('--glow: none;')
    expect(css).toContain('--space-1: 4px;')
    expect(css).toContain('--radius-none: 0;')
    expect(css).toContain('--measure: 68ch;')
    expect(css).toContain('--font-mono: "JetBrains Mono", monospace;')
    expect(css).toContain('--text-meta: 400 13px/20px var(--font-mono);')
  })

  it('writes a tracking role per type style, normal when the style has none', () => {
    expect(css).toContain('--tracking-meta: normal;')
    expect(css).toContain('--tracking-eyebrow: 0.16em;')
  })

  it('writes the roles only: the typography classes live in the core', () => {
    expect(css).not.toContain('.bd-meta')
  })

  it('writes motion roles and resolves aliases in single-value tokens', () => {
    expect(css).toContain('--duration-base: 240ms;')
    expect(css).toContain('--ease-standard: cubic-bezier(0.2, 0, 0, 1);')
    expect(css).toContain('--space-section: var(--space-1);')
  })

  it('writes viewport-dependent roles in a min-width media query', () => {
    expect(css).toContain('--space-inline: 20px;')
    expect(css).toContain('@media (min-width: 768px) {\n  :root {\n    --space-inline: max(24px, 5vw);\n  }\n}')
  })

  it('does not write a Tailwind @theme block', () => {
    expect(css).not.toContain('@theme')
    expect(css).not.toContain('--color-surface')
  })

  it('is deterministic', () => {
    expect(buildTokensCss(fixture, { noche: ['.dark'], dia: ['.light'] })).toBe(css)
  })

  it('rejects a single-value token with per-mode values', () => {
    const bad = { ...fixture, spacing: { tokens: [{ name: 'space-x', value: { noche: '1px', dia: '2px' } }] } }
    expect(() => buildTokensCss(bad)).toThrow(/space-x/)
  })

  it('rejects "at" on a per-mode token', () => {
    const bad = { ...fixture, shadow: { tokens: [{ name: 'glow', value: { noche: 'a', dia: 'b' }, at: { '768px': 'c' } }] } }
    expect(() => buildTokensCss(bad)).toThrow(/glow/)
  })

  it('resolves references inside "at" values', () => {
    const ref = { ...fixture, spacing: { tokens: [{ name: 'space-inline', value: '1px', at: { '768px': 'calc(100% - {measure})' } }] } }
    expect(buildTokensCss(ref)).toContain('--space-inline: calc(100% - var(--measure));')
  })

  it('rejects an alias for an unknown mode', () => {
    expect(() => buildTokensCss(fixture, { tarde: ['.x'] })).toThrow(/tarde/)
  })

  it('rejects token names and mode ids outside [\\w-]', () => {
    const name = { ...fixture, radius: { tokens: [{ name: 'a}b{c', value: '0' }] } }
    expect(() => buildTokensCss(name)).toThrow('token name "a}b{c"')
    expect(() => buildTokensCss({ ...fixture, modes: [{ id: 'x"]', scheme: 'dark' }] })).toThrow(/mode id/)
  })

  it.each([
    ['a semicolon', 'red; color: blue'],
    ['a brace', 'red }'],
    ['an angle bracket', '</style>'],
    ['an at-rule', '@import "x"'],
    ['a backtick', '`x`'],
    ['url()', 'URL(https://x.test/a.png)'],
  ])('rejects a value with %s, naming the theme, token and mode', (_label, value) => {
    const bad = { ...fixture, id: 'evil', color: { tokens: [{ name: 'surface', value: { noche: '#000', dia: value } }] } }
    expect(() => buildTokensCss(bad)).toThrow(/Theme "evil": token "surface" in mode "dia" has an unsafe value/)
  })

  it('rejects unsafe values in single-value, "at" and type roles', () => {
    expect(() => buildTokensCss({ ...fixture, radius: { tokens: [{ name: 'r', value: '0; x' }] } })).toThrow(/token "r"/)
    expect(() => buildTokensCss({ ...fixture, spacing: { tokens: [{ name: 's', value: '1px', at: { '768px': '2px;}' } }] } })).toThrow(/token "s"/)
    expect(() => buildTokensCss({ ...fixture, type: { families: { x: 'a; b' } } })).toThrow(/font-x/)
  })

  it('accepts references and CSS functions', () => {
    const ok = { ...fixture, spacing: { tokens: [{ name: 's', value: '{space-1}', at: { '768px': 'max(clamp(24px, 8vw, 120px), calc((100% - {container}) / 2))' } }] } }
    expect(buildTokensCss(ok)).toContain('var(--container)')
  })

  it('rejects a theme without modes', () => {
    expect(() => buildTokensCss({ ...fixture, modes: [] })).toThrow(/no modes/)
  })
})

describe('scripts/build-tokens.mjs', () => {
  it('prints the roles of a theme, or writes them to a file', () => {
    const printed = execFileSync('node', [SCRIPT, BOGOTA], { encoding: 'utf8' })
    expect(printed).toBe(buildTokensCss(JSON.parse(readFileSync(BOGOTA, 'utf8'))))
    const out = join(mkdtempSync(join(tmpdir(), 'bd-tokens-')), 'roles.css')
    execFileSync('node', [SCRIPT, BOGOTA, out])
    expect(readFileSync(out, 'utf8')).toBe(printed)
  })

  it('fails on a theme without modes', () => {
    const bad = join(mkdtempSync(join(tmpdir(), 'bd-tokens-')), 'theme.json')
    writeFileSync(bad, JSON.stringify({ ...fixture, modes: [] }))
    expect(() => execFileSync('node', [SCRIPT, bad], { stdio: 'pipe' })).toThrow()
  })
})

describe('Bogotá\'s theme.json', () => {
  const data = JSON.parse(readFileSync(BOGOTA, 'utf8')) as ThemeData & { contract: number, id: string }
  const generated = buildTokensCss(data)

  it('declares every contract v1 role that is not a color', () => {
    const roles = [
      'radius-control', 'radius-card', 'radius-full', 'shadow-raised', 'shadow-overlay', 'glow-accent',
      'space-section', 'space-gutter', 'space-inline', 'container', 'measure', 'nav-height',
      'duration-fast', 'duration-base', 'duration-slow', 'ease-standard', 'ease-emphasized',
      ...['display-xl', 'display-l', 'heading-1', 'heading-2', 'heading-3', 'body-l', 'body', 'body-s', 'eyebrow', 'meta', 'code']
        .flatMap(style => [`text-${style}`, `tracking-${style}`]),
    ]
    for (const role of roles) expect(generated).toContain(`--${role}:`)
  })

  it('has a class in the core for every type style', () => {
    const typography = readFileSync('app/assets/css/settings/typography.css', 'utf8')
    const styles = (data.type?.groups ?? []).flatMap(group => group.styles.map(style => style.name))
    expect(styles).toHaveLength(11)
    for (const style of styles) {
      expect(block(typography, `.bd-${style} {`)).toContain(`font: var(--text-${style});`)
      expect(block(typography, `.bd-${style} {`)).toContain(`letter-spacing: var(--tracking-${style});`)
    }
  })

  it('defines every color token of the design system in both modes', () => {
    // Bogotá's primitives and base roles (25), plus the semantic roles of ADR 0005 (29)
    expect(data.color.tokens).toHaveLength(54)
    const names = data.color.tokens.map(token => token.name)
    for (const role of ['accent', 'accent-hover', 'on-accent', 'link-soft', 'danger-soft', 'info', 'category-1', 'category-5-soft', 'code-keyword']) {
      expect(names).toContain(role)
    }
    for (const { name } of data.color.tokens) {
      expect(block(generated, '[data-theme="noche"]')).toContain(`--${name}:`)
      expect(block(generated, '[data-theme="dia"]')).toContain(`--${name}:`)
    }
  })

  it('declares its modes, contract, and an empty layout and slots', () => {
    expect(data).toMatchObject({ contract: 1, id: 'bogota', layout: {}, slots: {} })
    expect(data.modes.map(mode => [mode.id, mode.scheme])).toEqual([['noche', 'dark'], ['dia', 'light']])
  })
})
