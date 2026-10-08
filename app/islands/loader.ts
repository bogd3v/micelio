// Loads the heavy islands of the page (ADR 0006, section 6). A heavy island's entry is not in the HTML: this small script,
// which is, waits for the island's element to be near the viewport and imports the entry then. The entry defines the element.
import { HEAVY_SCAN_EVENT, HEAVY_SCRIPT_PREFIX, parseHeavyDeclaration } from '../helpers/islands'
import { whenVisible } from './lib/trigger'

const requested = new Set<string>()
let waiting: AbortController | undefined

function scan(): void {
  // A new scan replaces the waits of the previous page
  waiting?.abort()
  const controller = new AbortController()
  waiting = controller
  for (const script of document.querySelectorAll(`script[id^="${HEAVY_SCRIPT_PREFIX}"]`)) {
    const declaration = parseHeavyDeclaration(script.textContent)
    if (!declaration || requested.has(declaration.src)) continue
    const elements = Array.from(document.querySelectorAll(declaration.tag))
    if (!elements.length) continue
    Promise.any(elements.map(element => whenVisible(element, { signal: controller.signal })))
      .then(() => {
        requested.add(declaration.src)
        return import(/* @vite-ignore */ declaration.src)
      })
      .catch(() => {
        // Aborted by a newer scan, or the entry did not load (the next scan tries again)
        requested.delete(declaration.src)
      })
  }
}

document.addEventListener(HEAVY_SCAN_EVENT, scan)
scan()
