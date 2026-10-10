import type { CodeLine } from '../interfaces/design'

const PROMPT = /^\$ /

/**
 * Splits a code block into lines. A line that starts with `$ ` is a shell prompt: its `prompt` is true and `text` drops the `$ `.
 *
 * @remarks
 * One trailing newline is dropped first.
 */
export function splitCodeLines(code: string): CodeLine[] {
  return code
    .replace(/\n$/, '')
    .split('\n')
    .map(line => (PROMPT.test(line) ? { prompt: true, text: line.slice(2) } : { prompt: false, text: line }))
}

/** The text the copy button copies: the lines joined by newlines, without the prompt marks. */
export function copyableCode(lines: CodeLine[]): string {
  return lines.map(line => line.text).join('\n')
}

/** Escapes `&`, `<`, `>`, `"` and `'` so the text can go in HTML text or in a quoted attribute. */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

/**
 * The HTML of a code block: a `figure` with the language label, a copy button and the code, with prompts marked.
 *
 * @remarks
 * The copy button is `hidden` until the script shows it. `lang` is reduced to letters, digits, `_` and `-` rather than escaped;
 * the code is escaped.
 */
export function renderCodeBlockHtml(code: string, lang: string): string {
  const safeLang = lang.replace(/[^\w-]/g, '')
  const body = splitCodeLines(code)
    .map(line => (line.prompt ? `<span class="myc-prompt">$ </span>` : '') + escapeHtml(line.text))
    .join('\n')
  const langLabel = safeLang ? `<span class="myc-code-lang">${safeLang}</span>` : ''
  const codeClass = safeLang ? ` class="language-${safeLang}"` : ''
  return `<figure class="myc-code not-prose"><div class="myc-code-head">${langLabel}<button type="button" class="myc-code-copy" data-myc-copy hidden></button></div><pre tabindex="0"><code${codeClass}>${body}</code></pre></figure>\n`
}
