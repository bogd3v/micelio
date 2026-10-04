import { describe, it, expect } from 'vitest'
import type { MermaidTokens } from '../app/helpers/mermaid'
import { MERMAID_TOKENS, mermaidThemeVariables, mermaidTitle, renderMermaidBlockHtml } from '../app/helpers/mermaid'

const tokens = Object.fromEntries(MERMAID_TOKENS.map(name => [name, `#${name}`])) as MermaidTokens

describe('renderMermaidBlockHtml', () => {
  it('wraps the source in a mermaid container with the code block as fallback', () => {
    const html = renderMermaidBlockHtml('flowchart LR\n  A --> B')
    expect(html.startsWith('<div class="bd-mermaid not-prose"><figure class="bd-code not-prose">')).toBe(true)
    expect(html).toContain('<span class="bd-code-lang">mermaid</span>')
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
  it('builds the palette from the design tokens as DESIGN.md section 7 maps them', () => {
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
