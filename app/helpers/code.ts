import type { CodeLine } from '../interfaces/design'

const PROMPT = /^\$ /

export function splitCodeLines(code: string): CodeLine[] {
  return code
    .replace(/\n$/, '')
    .split('\n')
    .map(line => (PROMPT.test(line) ? { prompt: true, text: line.slice(2) } : { prompt: false, text: line }))
}

export function copyableCode(lines: CodeLine[]): string {
  return lines.map(line => line.text).join('\n')
}

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function renderCodeBlockHtml(code: string, lang: string): string {
  const safeLang = lang.replace(/[^\w-]/g, '')
  const body = splitCodeLines(code)
    .map(line => (line.prompt ? `<span class="myc-prompt">$ </span>` : '') + escapeHtml(line.text))
    .join('\n')
  const langLabel = safeLang ? `<span class="myc-code-lang">${safeLang}</span>` : ''
  const codeClass = safeLang ? ` class="language-${safeLang}"` : ''
  return `<figure class="myc-code not-prose"><div class="myc-code-head">${langLabel}<button type="button" class="myc-code-copy" data-myc-copy hidden></button></div><pre tabindex="0"><code${codeClass}>${body}</code></pre></figure>\n`
}
