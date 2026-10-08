// <micelio-mermaid>: draws the diagram of a Mermaid block (ADR 0006, section 6). The server markup holds the source code
// block, which stays on any failure. The loader (`loader.ts`) imports this file when a block nears the viewport after load and idle,
// and Mermaid itself loads on the first draw. It does not share modules with the loader, or the loader would load a chunk at start.
// The loader imports this file after the page has hydrated, so the SVG goes into the light DOM without Vue's v-html seeing a mismatch.
import type { Mermaid } from 'mermaid'
import type { MermaidTokens } from '../helpers/mermaid'
import { MERMAID_CONFIG_ID, MERMAID_CSS, MERMAID_TOKENS, mermaidThemeVariables, mermaidTitle, parseMermaidConfig, resolveMermaidOverrides } from '../helpers/mermaid'

const DIAGRAM_CLASS = 'bd-mermaid-diagram'
const READY_CLASS = 'bd-mermaid-ready'
const DEFAULT_LABEL = 'Diagram'

let sequence = 0
let mermaidModule: Promise<Mermaid> | undefined
// Mermaid is configured globally, so one render at a time
let queue: Promise<void> = Promise.resolve()
const drawn = new Set<MicelioMermaid>()
let observer: MutationObserver | undefined

async function importMermaid(): Promise<Mermaid> {
  try {
    return (await import('mermaid')).default
  } catch (error: unknown) {
    // A failed load is retried by the next block
    mermaidModule = undefined
    throw error
  }
}

function loadMermaid(): Promise<Mermaid> {
  mermaidModule ??= importMermaid()
  return mermaidModule
}

async function ignore(task: Promise<unknown>): Promise<void> {
  try {
    await task
  } catch {
    // The element already shows its source
  }
}

function readTokens(): MermaidTokens {
  const style = getComputedStyle(document.documentElement)
  return Object.fromEntries(MERMAID_TOKENS.map(name => [name, style.getPropertyValue(`--${name}`).trim()])) as MermaidTokens
}

function configure(mermaid: Mermaid): void {
  const style = getComputedStyle(document.documentElement)
  const config = parseMermaidConfig(document.getElementById(MERMAID_CONFIG_ID)?.textContent)
  const tokens = readTokens()
  const dark = document.documentElement.getAttribute('data-scheme') === 'dark'
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    suppressErrorRendering: true,
    theme: 'base',
    flowchart: { useMaxWidth: false },
    sequence: { useMaxWidth: false },
    fontFamily: tokens['font-mono'],
    themeVariables: mermaidThemeVariables(tokens, dark, resolveMermaidOverrides(config.overrides, role => style.getPropertyValue(`--${role}`))),
    themeCSS: MERMAID_CSS,
  })
}

function track(element: MicelioMermaid): void {
  drawn.add(element)
  // A new theme or mode changes data-theme and data-scheme: every tracked diagram is drawn again with the new roles
  observer ??= new MutationObserver(() => {
    for (const item of drawn) {
      if (item.isConnected) void ignore(item.draw())
      else untrack(item)
    }
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-scheme'] })
}

function untrack(element: MicelioMermaid): void {
  drawn.delete(element)
  if (!drawn.size) observer?.disconnect()
}

class MicelioMermaid extends HTMLElement {
  private abort: AbortController | undefined
  private run = 0

  connectedCallback(): void {
    // Moved while drawn: it keeps its diagram and follows the theme again
    if (this.classList.contains(READY_CLASS)) {
      track(this)
      return
    }
    if (this.abort) return
    const abort = new AbortController()
    this.abort = abort
    void ignore(this.start(abort.signal))
  }

  disconnectedCallback(): void {
    this.abort?.abort()
    this.abort = undefined
    this.run++
    untrack(this)
  }

  private async start(signal: AbortSignal): Promise<void> {
    if (signal.aborted) return
    // Tracked before the first draw, so a theme change during it draws again
    track(this)
    await this.draw()
  }

  draw(): Promise<void> {
    const current = ++this.run
    const task = this.drawAfter(queue, current)
    queue = ignore(task)
    return task
  }

  private async drawAfter(previous: Promise<void>, current: number): Promise<void> {
    await previous
    await this.render(current)
  }

  private showSource(): void {
    this.classList.remove(READY_CLASS)
    this.querySelector(`.${DIAGRAM_CLASS}`)?.remove()
  }

  private async render(current: number): Promise<void> {
    if (current !== this.run) return
    const source = this.querySelector('code')?.textContent ?? ''
    try {
      const mermaid = await loadMermaid()
      configure(mermaid)
      const { svg } = await mermaid.render(`bd-mermaid-${++sequence}`, source)
      if (current !== this.run) return
      let diagram = this.querySelector<HTMLElement>(`.${DIAGRAM_CLASS}`)
      if (!diagram) {
        diagram = document.createElement('div')
        diagram.className = DIAGRAM_CLASS
        diagram.setAttribute('role', 'img')
        diagram.tabIndex = 0
        this.prepend(diagram)
      }
      diagram.setAttribute('aria-label', mermaidTitle(source) ?? parseMermaidConfig(document.getElementById(MERMAID_CONFIG_ID)?.textContent, DEFAULT_LABEL).label)
      diagram.innerHTML = svg
      this.classList.add(READY_CLASS)
    } catch {
      if (current === this.run) {
        this.showSource()
        untrack(this)
      }
    }
  }
}

if (!customElements.get('micelio-mermaid')) customElements.define('micelio-mermaid', MicelioMermaid)
