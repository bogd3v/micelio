import { describe, it, expect } from 'vitest'
import { copyableCode, renderCodeBlockHtml, splitCodeLines } from '~/helpers/code'

describe('splitCodeLines', () => {
  it('detects prompt lines and drops the trailing newline', () => {
    expect(splitCodeLines('$ npm i\nok\n')).toEqual([
      { prompt: true, text: 'npm i' },
      { prompt: false, text: 'ok' },
    ])
  })

  it('does not treat a dollar without a space as a prompt', () => {
    expect(splitCodeLines('$HOME')).toEqual([{ prompt: false, text: '$HOME' }])
  })
})

describe('copyableCode', () => {
  it('joins lines without prompts', () => {
    expect(copyableCode(splitCodeLines('$ a\nb'))).toBe('a\nb')
  })
})

describe('renderCodeBlockHtml', () => {
  it('makes the block focusable so a scrolling one can be read by keyboard', () => {
    expect(renderCodeBlockHtml('x', 'js')).toContain('<pre tabindex="0">')
  })

  it('renders the design system markup with an inactive copy button', () => {
    const html = renderCodeBlockHtml('$ echo "<hola>"', 'bash')
    expect(html).toContain('<figure class="bd-code not-prose">')
    expect(html).toContain('<span class="bd-code-lang">bash</span>')
    expect(html).toContain('<button type="button" class="bd-code-copy" data-bd-copy hidden></button>')
    expect(html).toContain('<code class="language-bash"><span class="bd-prompt">$ </span>echo &quot;&lt;hola&gt;&quot;</code>')
  })

  it('strips unsafe characters from the language', () => {
    const html = renderCodeBlockHtml('x', 'js" onclick="x')
    expect(html).toContain('class="language-jsonclickx"')
    expect(html).not.toContain('onclick="')
  })

  it('omits the language label when there is none', () => {
    const html = renderCodeBlockHtml('x', '')
    expect(html).not.toContain('bd-code-lang')
    expect(html).toContain('<code>x</code>')
  })
})
