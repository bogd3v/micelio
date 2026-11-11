import { expect, type Locator, type Page } from '@playwright/test'

/**
 * Tab (and Shift+Tab) through a modal dialog. The page behind is inert, so focus is either inside the
 * dialog or has left for the browser's own UI (the body, for the page); it never reaches page content,
 * and Tab comes back into the dialog.
 */
export async function tabThroughDialog(page: Page, dialog: Locator, presses: number): Promise<void> {
  let inside = 0
  let left = false
  for (let i = 0; i < presses; i++) {
    await page.keyboard.press(i % 3 === 2 ? 'Shift+Tab' : 'Tab')
    const where = await dialog.evaluate(el => el.contains(document.activeElement) ? 'dialog' : document.activeElement === document.body ? 'browser' : 'page')
    expect(where).not.toBe('page')
    if (where === 'dialog') inside++
    else left = true
  }
  expect(inside).toBeGreaterThan(1)
  // Focus left only because the dialog has few stops, and Tab brought it back
  if (left) expect(await dialog.evaluate(el => el.contains(document.activeElement) || document.activeElement === document.body)).toBe(true)
}

/** One stop of the Tab order: its label, its box on the page (scroll added) and the fixed or sticky layer it belongs to, if any. */
export interface TabStop {
  label: string
  top: number
  bottom: number
  left: number
  right: number
  /** `fixed` for the tab bar, the privacy notice and the Back to top button; `top` for the skip links and the sticky header; `null` for the page */
  layer: 'fixed' | 'top' | null
  /** The ancestors from the top of the page down to the stop: a number that tells elements apart and the rows of the page the element spans, and whether it lays its content out in CSS columns */
  path: Array<{ id: number, top: number, bottom: number, columns: boolean }>
}

/**
 * Press Tab from the top of the page until focus leaves it (the body, the browser's own UI) or wraps to the first stop and return every stop in order.
 * The page is scrolled `scrolled` px first, so the shown-on-scroll layers (the Back to top button) are in the page.
 */
export async function tabStops(page: Page, scrolled: number, limit = 300): Promise<TabStop[]> {
  await page.evaluate(y => window.scrollTo(0, y), scrolled)
  const stops: TabStop[] = []
  for (let step = 0; step < limit; step++) {
    await page.keyboard.press('Tab')
    const stop = await page.evaluate((): TabStop | null => {
      const element = document.activeElement as HTMLElement | null
      if (!element || element === document.body) return null
      const box = element.getBoundingClientRect()
      let layer: TabStop['layer'] = element.closest('.myc-skip-link') ? 'top' : null
      for (let node: HTMLElement | null = element; node; node = node.parentElement) {
        const position = getComputedStyle(node).position
        if (position === 'fixed' && layer === null) {
          layer = 'fixed'
          break
        }
        if (position === 'sticky') layer = 'top'
      }
      const store = window as unknown as { __focusIds?: WeakMap<Element, number>, __focusCount?: number }
      const ids = (store.__focusIds ??= new WeakMap<Element, number>())
      const path: TabStop['path'] = []
      for (let node: Element | null = element; node && node !== document.body; node = node.parentElement) {
        if (!ids.has(node)) ids.set(node, store.__focusCount = (store.__focusCount ?? 0) + 1)
        const rect = node.getBoundingClientRect()
        const style = getComputedStyle(node)
        path.unshift({ id: ids.get(node)!, top: rect.top + window.scrollY, bottom: rect.bottom + window.scrollY, columns: style.columnCount !== 'auto' || style.columnWidth !== 'auto' })
      }
      const label = element.getAttribute('aria-label') || element.textContent?.trim() || element.className || element.tagName.toLowerCase()
      return { label: label.slice(0, 40), top: box.top + window.scrollY, bottom: box.bottom + window.scrollY, left: box.left, right: box.right, layer, path }
    })
    if (!stop) return stops
    // Firefox keeps focus in the page after the last stop and wraps to the first
    const first = stops[0]
    if (first && first.label === stop.label && first.left === stop.left && first.layer === stop.layer) return stops
    stops.push(stop)
  }
  throw new Error(`Focus never left the page in ${limit} Tab presses`)
}

/**
 * Whether two stops sit in blocks side by side: the blocks directly under their closest common ancestor share rows of the page (the footer's
 * link columns, the cards of a row, a guide beside a form). Each is read as a list of its own, one after the other, so a stop of the second
 * may start higher than the last stop of the first. This is the limit of the oracle: it cannot tell a column that should be read first from one
 * that is read after, as long as the two blocks are side by side; stacked blocks it does tell.
 */
function arePeers(first: TabStop, second: TabStop): boolean {
  let depth = 0
  while (depth < first.path.length && depth < second.path.length && first.path[depth]!.id === second.path[depth]!.id) depth++
  const a = first.path[depth]
  const b = second.path[depth]
  if (!a || !b) return false
  // The items of a CSS multi-column container flow from one column into the next, without a block of their own for each
  if (depth > 0 && first.path[depth - 1]!.columns) return true
  return a.top < b.bottom && b.top < a.bottom
}

/**
 * Where the Tab order departs from the reading order, as one message per departure. The order is read as a page is: rows from the top,
 * and inside a row from the left. A stop below the previous one starts a new row band; a stop above the previous one is allowed only when
 * it starts to the right of it and either still overlaps the band (the next column of the same row) or sits in a block beside the previous stop's (`arePeers`: the next column of a list of columns), never above the band's top otherwise.
 * The skip links and the sticky header come before the page, and the fixed layers (tab bar, privacy notice, Back to top button), which have no place in the flow, after it.
 */
export function orderDepartures(stops: TabStop[]): string[] {
  const departures: string[] = []
  const lastFlow = stops.findLastIndex(stop => stop.layer === null)
  const firstFlow = stops.findIndex(stop => stop.layer === null)
  stops.forEach((stop, index) => {
    if (stop.layer === 'fixed' && index < lastFlow) departures.push(`"${stop.label}" (fixed) comes before "${stops[lastFlow]!.label}", the last stop of the page`)
    if (stop.layer === 'top' && index > firstFlow) departures.push(`"${stop.label}" (top) comes after "${stops[firstFlow]!.label}", the first stop of the page`)
  })
  const flow = stops.filter(stop => stop.layer === null)
  let band = flow.length ? { top: flow[0]!.top, bottom: flow[0]!.bottom } : { top: 0, bottom: 0 }
  flow.forEach((stop, index) => {
    const before = flow[index - 1]
    if (!before) return
    if (stop.top >= band.bottom - 1) {
      band = { top: stop.top, bottom: stop.bottom }
      return
    }
    if (stop.top < band.top - 1) {
      const nextColumn = stop.left >= before.right - 1 && (stop.bottom > band.top || arePeers(before, stop))
      if (!nextColumn) departures.push(`"${stop.label}" (${Math.round(stop.left)},${Math.round(stop.top)}) comes after "${before.label}" (${Math.round(before.left)},${Math.round(before.top)}), above the row it reads in (top ${Math.round(band.top)})`)
    }
    band = { top: Math.min(band.top, stop.top), bottom: Math.max(band.bottom, stop.bottom) }
  })
  return departures
}
