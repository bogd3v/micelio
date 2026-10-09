// <micelio-search>: upgrades the complete server markup of MycSearchIsland into the static search palette (ADR 0006, sections 3 and 4).
// Strings come from the server in data attributes; Pagefind (JS, WASM, index) loads when the palette first opens.
import { excerptSegments, plainText } from '../helpers/excerpt'
import { cycleIndex, highlightSegments, MIN_SEARCH_LENGTH, resultPath } from '../helpers/search'
import type { TextSegment } from '../interfaces/design'

interface PagefindResultData {
  url: string
  excerpt: string
  meta: Record<string, string | undefined>
}

interface PagefindApi {
  options: (options: { baseUrl: string }) => Promise<void>
  init: () => Promise<void>
  debouncedSearch: (term: string, options?: object, wait?: number) => Promise<{ results: Array<{ data: () => Promise<PagefindResultData> }> } | null>
}

const MAX_RESULTS = 8
const TRIGGER = 'a[data-micelio-search-open]'

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}

// Only text nodes and <mark class="myc-mark">: results never go through innerHTML
function fill(parent: HTMLElement, segments: TextSegment[]): void {
  parent.replaceChildren(...segments.map(segment => (segment.match ? element('mark', 'myc-mark', segment.text) : document.createTextNode(segment.text))))
}

class MicelioSearch extends HTMLElement {
  private dialog!: HTMLDialogElement
  private input!: HTMLInputElement
  private list!: HTMLElement
  private note!: HTMLElement
  private status!: HTMLElement
  private count!: HTMLElement
  private opener: HTMLElement | null = null
  private pagefind: Promise<PagefindApi> | undefined
  private options: HTMLElement[] = []
  private active = -1
  private request = 0

  connectedCallback(): void {
    const dialog = this.querySelector('dialog')
    const input = this.querySelector<HTMLInputElement>('input[role="combobox"]')
    const list = this.querySelector<HTMLElement>('[role="listbox"]')
    const note = this.querySelector<HTMLElement>('[data-search-note]')
    const status = this.querySelector<HTMLElement>('[role="status"]')
    const count = this.querySelector<HTMLElement>('[data-search-count]')
    if (!dialog || !input || !list || !note || !status || !count) return
    Object.assign(this, { dialog, input, list, note, status, count })

    for (const link of document.querySelectorAll<HTMLAnchorElement>(TRIGGER)) this.upgradeTrigger(link)
    document.addEventListener('keydown', this.onShortcut)
    dialog.addEventListener('close', () => this.onClose())
    // Escape closes natively; the backdrop is the dialog element itself
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close()
    })
    this.querySelector('.myc-palette-esc')?.addEventListener('click', () => dialog.close())
    input.addEventListener('input', () => this.search())
    input.addEventListener('keydown', event => this.onKeydown(event))
  }

  disconnectedCallback(): void {
    document.removeEventListener('keydown', this.onShortcut)
  }

  // The link to /blog (what works without JS) becomes the button that opens the palette
  private upgradeTrigger(link: HTMLAnchorElement): void {
    const button = element('button')
    button.type = 'button'
    for (const { name, value } of link.attributes) {
      // A link to /blog is "current" on /blog; the button opens a palette and is not
      if (name === 'href' || name === 'data-micelio-search-open' || name === 'aria-current') continue
      button.setAttribute(name, name === 'class' ? value.split(/\s+/).filter(item => item && !item.startsWith('router-link-')).join(' ') : value)
    }
    button.setAttribute('aria-haspopup', 'dialog')
    button.setAttribute('aria-keyshortcuts', 'Control+K Meta+K')
    button.append(...link.childNodes)
    button.addEventListener('click', () => this.open(button))
    link.replaceWith(button)
  }

  private readonly onShortcut = (event: KeyboardEvent): void => {
    if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'k') return
    event.preventDefault()
    if (this.dialog.open) this.dialog.close()
    else this.open(document.activeElement instanceof HTMLElement ? document.activeElement : null)
  }

  open(opener: HTMLElement | null): void {
    if (this.dialog.open) return
    this.opener = opener
    this.dialog.showModal()
    this.input.focus()
    // The first open starts loading Pagefind, so the first query does not wait for it
    void this.preload()
    if (this.input.value) this.search()
  }

  private onClose(): void {
    this.request++
    this.input.value = ''
    this.clear()
    this.opener?.focus()
    this.opener = null
  }

  private load(): Promise<PagefindApi> {
    // The module is always <app.baseURL>/pagefind/pagefind.js of this origin, never a URL taken from the markup
    const base = /^\/(?!\/)[\w./-]*$/.test(this.dataset.baseUrl ?? '') ? this.dataset.baseUrl!.replace(/\/+$/, '') : ''
    this.pagefind ??= this.importPagefind(base)
    return this.pagefind
  }

  private async importPagefind(base: string): Promise<PagefindApi> {
    try {
      const api: PagefindApi = await import(/* @vite-ignore */ `${base}/pagefind/pagefind.js`)
      await api.options({ baseUrl: `${base}/` })
      await api.init()
      return api
    } catch (error: unknown) {
      // A failed load is retried on the next query
      this.pagefind = undefined
      throw error
    }
  }

  private async preload(): Promise<void> {
    try {
      await this.load()
    } catch {
      // The query that needs Pagefind shows the error
    }
  }

  private label(name: string, values: Record<string, string> = {}): string {
    return Object.entries(values).reduce((text, [key, value]) => text.replaceAll(`{${key}}`, () => value), this.dataset[name] ?? '')
  }

  private setNote(text: string): void {
    this.note.textContent = text
    this.note.hidden = text === ''
  }

  private announce(text: string): void {
    this.status.textContent = text
  }

  private clear(): void {
    this.list.replaceChildren()
    this.options = []
    this.active = -1
    this.input.removeAttribute('aria-activedescendant')
    this.input.setAttribute('aria-expanded', 'false')
    this.count.textContent = ''
    this.announce('')
    this.setNote(this.label('minLength', { count: String(MIN_SEARCH_LENGTH) }))
  }

  private async search(): Promise<void> {
    const term = this.input.value.trim()
    const request = ++this.request
    if (term.length < MIN_SEARCH_LENGTH) {
      this.clear()
      return
    }
    this.setNote(this.label('loading'))
    this.announce(this.label('loading'))
    try {
      const pagefind = await this.load()
      const found = await pagefind.debouncedSearch(term, {}, 150)
      // null: a newer query replaced this one
      if (!found || request !== this.request) return
      const data = await Promise.all(found.results.slice(0, MAX_RESULTS).map(result => result.data()))
      if (request === this.request) this.render(term, data)
    } catch {
      if (request !== this.request) return
      this.clear()
      this.setNote(this.label('unavailable'))
      this.announce(this.label('unavailable'))
    }
  }

  private render(term: string, data: PagefindResultData[]): void {
    const group = element('div', 'myc-palette-group')
    group.setAttribute('role', 'group')
    group.setAttribute('aria-labelledby', 'myc-palette-group-results')
    const heading = element('div', 'myc-eyebrow myc-palette-heading', this.label('groupResults'))
    heading.id = 'myc-palette-group-results'
    heading.setAttribute('role', 'presentation')
    group.append(heading)

    // Only paths of this site: a URL that is not `/…` (or is `//…`) is skipped
    const safe = data.flatMap((item) => {
      const path = resultPath(item.url)
      return path ? [{ item, path }] : []
    })
    data = safe.map(({ item }) => item)
    this.options = safe.map(({ item, path }, index) => {
      const link = element('a', 'myc-result')
      link.id = `myc-result-${index}`
      link.href = path
      link.tabIndex = -1
      link.setAttribute('role', 'option')
      link.setAttribute('aria-selected', 'false')
      const kind = element('span', 'myc-eyebrow myc-result-kind', this.label(item.meta.kind === 'page' ? 'kindPage' : 'kindArticle'))
      kind.setAttribute('aria-hidden', 'true')
      const text = element('span', 'myc-result-text')
      const title = element('span', 'myc-result-label')
      fill(title, highlightSegments(plainText(item.meta.title ?? '') || item.url, term))
      text.append(title)
      const excerpt = excerptSegments(item.excerpt)
      if (excerpt.length) {
        const snippet = element('span', 'myc-result-snippet')
        fill(snippet, excerpt)
        text.append(snippet)
      }
      const arrow = element('span', 'myc-meta myc-result-hint', '→')
      arrow.setAttribute('aria-hidden', 'true')
      link.append(kind, text, arrow)
      link.addEventListener('mousemove', () => this.activate(index))
      group.append(link)
      return link
    })

    this.list.replaceChildren(...(data.length ? [group] : []))
    this.active = -1
    this.input.removeAttribute('aria-activedescendant')
    this.input.setAttribute('aria-expanded', data.length ? 'true' : 'false')
    const total = this.label(data.length === 0 ? 'resultsNone' : data.length === 1 ? 'resultsOne' : 'resultsOther', { count: String(data.length) })
    this.count.textContent = total
    this.setNote(data.length ? '' : this.label('empty', { query: term }))
    this.announce(data.length ? total : this.label('empty', { query: term }))
  }

  private activate(index: number): void {
    if (index === this.active) return
    this.options[this.active]?.classList.remove('myc-result-active')
    this.options[this.active]?.setAttribute('aria-selected', 'false')
    this.active = index
    const option = this.options[index]
    if (!option) {
      this.input.removeAttribute('aria-activedescendant')
      return
    }
    option.classList.add('myc-result-active')
    option.setAttribute('aria-selected', 'true')
    this.input.setAttribute('aria-activedescendant', option.id)
    option.scrollIntoView({ block: 'nearest' })
  }

  private onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      // In a search field Escape would only clear the text first
      event.preventDefault()
      this.dialog.close()
    } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      this.activate(cycleIndex(this.active, this.options.length, event.key === 'ArrowDown' ? 1 : -1))
    } else if (event.key === 'Enter') {
      const option = this.options[this.active]
      if (!option) return
      event.preventDefault()
      option.click()
    }
  }
}

if (!customElements.get('micelio-search')) customElements.define('micelio-search', MicelioSearch)
