import { describe, it, expect, beforeAll } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const SCRIPT = join(process.cwd(), 'scripts/build-tokens.mjs')

const fixture = {
  color: {
    themes: [{ id: 'noche' }, { id: 'dia' }],
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
  layout: { tokens: [{ name: 'measure', value: '68ch' }] },
  motion: { tokens: [{ name: 'duration-base', value: '240ms' }, { name: 'ease-standard', value: 'cubic-bezier(0.2, 0, 0, 1)' }] },
  type: {
    families: { mono: '"JetBrains Mono", monospace' },
    groups: [{ family: 'mono', styles: [
      { name: 'meta', fontSize: '13px', lineHeight: '20px', fontWeight: 400 },
      { name: 'eyebrow', fontSize: '12px', lineHeight: '16px', fontWeight: 500, letterSpacing: '0.16em' },
    ] }],
  },
}

function run(args: string[]): string {
  return execFileSync('node', [SCRIPT, ...args], { encoding: 'utf8', stdio: 'pipe' })
}

function block(css: string, selector: string): string {
  const start = css.indexOf(selector)
  return css.slice(start, css.indexOf('}', start))
}

describe('build-tokens', () => {
  let dir: string
  let input: string
  let output: string
  let css: string

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'bd-tokens-'))
    input = join(dir, 'tokens.json')
    output = join(dir, 'tokens.css')
    writeFileSync(input, JSON.stringify(fixture))
    run(['--alias', 'noche=.dark', '--alias', 'dia=.light', input, output])
    css = readFileSync(output, 'utf8')
  })

  it('writes each theme with its own values, the first one also on :root', () => {
    expect(css).toContain(':root,\n[data-theme="noche"],\n.dark {')
    expect(block(css, '[data-theme="noche"]')).toContain('--surface: #000000;')
    expect(block(css, '[data-theme="noche"]')).toContain('color-scheme: dark;')
    expect(css).toContain('[data-theme="dia"],\n.light {')
    expect(block(css, '[data-theme="dia"]')).toContain('--surface: #ffffff;')
    expect(block(css, '[data-theme="dia"]')).toContain('color-scheme: light;')
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

  it('writes a class per type style that reads its text and tracking roles', () => {
    expect(block(css, '.bd-meta {')).toContain('font: var(--text-meta);')
    expect(block(css, '.bd-meta {')).toContain('letter-spacing: var(--tracking-meta);')
    expect(block(css, '.bd-eyebrow {')).toContain('letter-spacing: var(--tracking-eyebrow);')
  })

  it('writes a tracking role per type style, normal when the style has none', () => {
    expect(css).toContain('--tracking-meta: normal;')
    expect(css).toContain('--tracking-eyebrow: 0.16em;')
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

  it('is deterministic and --check fails on a stale file', () => {
    expect(run(['--check', '--alias', 'noche=.dark', '--alias', 'dia=.light', input, output])).toContain('is up to date')
    expect(() => run(['--check', input, output])).toThrow()
  })

  it('rejects an alias for an unknown theme', () => {
    expect(() => run(['--alias', 'tarde=.x', input, join(dir, 'x.css')])).toThrow()
  })

  it('keeps app/assets/css/settings/tokens.css in sync with docs/design/tokens.json', () => {
    expect(() => execFileSync('npm', ['run', '-s', 'tokens:check'], { stdio: 'pipe' })).not.toThrow()
  })

  it('declares every contract v1 role that is not a color', () => {
    const generated = readFileSync('app/assets/css/settings/tokens.css', 'utf8')
    const roles = [
      'radius-control', 'radius-card', 'radius-full', 'shadow-raised', 'shadow-overlay', 'glow-accent',
      'space-section', 'space-gutter', 'space-inline', 'container', 'measure', 'nav-height',
      'duration-fast', 'duration-base', 'duration-slow', 'ease-standard', 'ease-emphasized',
      ...['display-xl', 'display-l', 'heading-1', 'heading-2', 'heading-3', 'body-l', 'body', 'body-s', 'eyebrow', 'meta', 'code']
        .flatMap(style => [`text-${style}`, `tracking-${style}`]),
    ]
    for (const role of roles) expect(generated).toContain(`--${role}:`)
  })

  it('defines every color token of the design system in both themes', () => {
    const data = JSON.parse(readFileSync('docs/design/tokens.json', 'utf8')) as { color: { tokens: { name: string }[] } }
    const generated = readFileSync('app/assets/css/settings/tokens.css', 'utf8')
    // Bogotá's primitives and base roles (25), plus the semantic roles of ADR 0005 (31)
    expect(data.color.tokens).toHaveLength(56)
    const names = data.color.tokens.map(token => token.name)
    for (const role of ['accent', 'accent-hover', 'on-accent', 'link-soft', 'danger-soft', 'info', 'category-1', 'category-6-soft', 'code-keyword']) {
      expect(names).toContain(role)
    }
    for (const { name } of data.color.tokens) {
      expect(block(generated, '[data-theme="noche"]')).toContain(`--${name}:`)
      expect(block(generated, '[data-theme="dia"]')).toContain(`--${name}:`)
    }
  })
})
