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
  spacing: { tokens: [{ name: 'space-1', value: '4px' }] },
  radius: { tokens: [{ name: 'radius-none', value: '0' }] },
  layout: { tokens: [{ name: 'measure', value: '68ch' }] },
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

  it('writes a class per type style with its letter spacing', () => {
    expect(block(css, '.bd-meta {')).toContain('font: var(--text-meta);')
    expect(block(css, '.bd-meta {')).not.toContain('letter-spacing')
    expect(block(css, '.bd-eyebrow {')).toContain('letter-spacing: 0.16em;')
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
