import { describe, it, expect } from 'vitest'
import type { MermaidTokens } from '../app/helpers/mermaid'
import { HEAVY_SCRIPT_PREFIX } from '../app/helpers/islands'
import { MERMAID_CONFIG_ID, MERMAID_TOKENS, mermaidThemeVariables, mermaidTitle, parseMermaidConfig, renderMermaidBlockHtml, resolveMermaidOverrides } from '../app/helpers/mermaid'

const tokens = Object.fromEntries(MERMAID_TOKENS.map(name => [name, `#${name}`])) as MermaidTokens

describe('renderMermaidBlockHtml', () => {
  it('wraps the source in a mermaid container with the code block as fallback', () => {
    const html = renderMermaidBlockHtml('flowchart LR\n  A --> B')
    expect(html.startsWith('<micelio-mermaid class="myc-mermaid not-prose"><figure class="myc-code not-prose">')).toBe(true)
    expect(html.trimEnd().endsWith('</micelio-mermaid>')).toBe(true)
    expect(html).toContain('<span class="myc-code-lang">mermaid</span>')
    expect(html).toContain('<code class="language-mermaid">flowchart LR\n  A --&gt; B</code>')
  })

  it('escapes markup in the source', () => {
    const html = renderMermaidBlockHtml('flowchart LR\n  A["<img src=x onerror=alert(1)>"]')
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
  })
})

describe('mermaidTitle', () => {
  it('reads the accessible title of the diagram', () => {
    expect(mermaidTitle('flowchart LR\n  accTitle: SSH login flow  \n  A --> B')).toBe('SSH login flow')
  })

  it('returns null when the diagram has no title', () => {
    expect(mermaidTitle('sequenceDiagram\n  A->>B: Hi')).toBeNull()
  })
})

describe('mermaidThemeVariables', () => {
  it('builds the palette from the design tokens as the theme roles map them', () => {
    const variables = mermaidThemeVariables(tokens, true)
    expect(variables).toMatchObject({
      darkMode: true,
      background: '#surface-sunken',
      fontFamily: '#font-mono',
      fontSize: '13px',
      primaryColor: '#surface-raised',
      primaryTextColor: '#ink',
      primaryBorderColor: '#line-strong',
      lineColor: '#link',
      arrowheadColor: '#link',
      signalColor: '#link',
      secondaryColor: '#surface',
      clusterBkg: '#surface',
      clusterBorder: '#line',
      noteBkgColor: '#warning-soft',
      noteTextColor: '#ink',
      errorBkgColor: '#danger-soft',
      errorTextColor: '#danger',
      radius: 0,
      useGradient: false,
    })
  })

  it('follows the theme brightness', () => {
    expect(mermaidThemeVariables(tokens, false).darkMode).toBe(false)
  })

  it('only uses the listed tokens', () => {
    const used = Object.values(mermaidThemeVariables(tokens, true)).filter((value): value is string => typeof value === 'string' && value.startsWith('#'))
    expect(used.every(value => MERMAID_TOKENS.includes(value.slice(1) as typeof MERMAID_TOKENS[number]))).toBe(true)
  })
})

describe('theme overrides', () => {
  it('replace the derived variables', () => {
    expect(mermaidThemeVariables(tokens, true, { lineColor: '#accent' }).lineColor).toBe('#accent')
    expect(mermaidThemeVariables(tokens, true, { lineColor: '#accent' }).arrowheadColor).toBe('#link')
  })

  it('resolve each role and skip the ones without a value', () => {
    const values: Record<string, string> = { accent: ' #f00 ', ink: '' }
    expect(resolveMermaidOverrides({ lineColor: 'accent', textColor: 'ink', noteBkgColor: 'missing' }, role => values[role] ?? '')).toEqual({ lineColor: '#f00' })
  })
})

describe('config script id', () => {
  it('is the heavy island script id of mermaid', () => {
    // Duplicated on purpose: the island must not import a module the loader imports
    expect(MERMAID_CONFIG_ID).toBe(`${HEAVY_SCRIPT_PREFIX}mermaid`)
  })
})

describe('parseMermaidConfig', () => {
  it('reads the label and the overrides', () => {
    expect(parseMermaidConfig('{"label":"Diagrama","overrides":{"lineColor":"accent"}}')).toEqual({ label: 'Diagrama', overrides: { lineColor: 'accent' } })
  })

  it('keeps only variable names and role names', () => {
    const config = parseMermaidConfig('{"overrides":{"lineColor":"accent","bad name":"ink","textColor":"red; x","a":3}}', 'Diagram')
    expect(config).toEqual({ label: 'Diagram', overrides: { lineColor: 'accent' } })
  })

  it('falls back on missing or malformed JSON', () => {
    expect(parseMermaidConfig(null, 'Diagram')).toEqual({ label: 'Diagram', overrides: {} })
    expect(parseMermaidConfig('{oops', 'Diagram')).toEqual({ label: 'Diagram', overrides: {} })
    expect(parseMermaidConfig('null', 'Diagram')).toEqual({ label: 'Diagram', overrides: {} })
    expect(parseMermaidConfig('{"label":1,"overrides":[]}', 'Diagram').label).toBe('Diagram')
  })
})
