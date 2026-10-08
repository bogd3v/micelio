// Loads the heavy islands of the page (ADR 0006, section 6). A heavy island's entry is not in the HTML: this small script,
// which is, imports it on the island's trigger. The entry defines the element.
// `visible`: the element is near the viewport, after load and idle. `interaction`: the declaration names a `control`; once the
// browser has the island's features and the page has hydrated, the control is shown, and its first press imports the entry and
// then presses it again, now that the entry listens.
// Keep it free of modules an island entry also imports: modules/islands.ts fails the build when they share one.
import type { HeavyFeature } from './heavy'
import { HEAVY_SCAN_EVENT, HEAVY_SCRIPT_PREFIX, heavyTag, parseHeavyDeclaration } from '../helpers/islands'
import type { HeavyDeclaration } from '../helpers/islands'
import { missingFeatures, prefersReducedMotion, saveData } from './lib/features'
import { whenHydrated } from './lib/hydrated'
import { whenInteracted, whenVisible } from './lib/trigger'

const loading = new Map<string, Promise<unknown>>()
const imported = new Set<string>()
// The scan whose wait a control is under: a newer scan arms a control whose scan was replaced, or it would stay shown and dead
const armed = new WeakMap<Element, AbortSignal>()
let waiting: AbortController | undefined

async function importEntry(src: string): Promise<unknown> {
  try {
    const module: unknown = await import(/* @vite-ignore */ src)
    imported.add(src)
    return module
  } catch (error: unknown) {
    // The next try imports again
    loading.delete(src)
    throw error
  }
}

function load(src: string): Promise<unknown> {
  let promise = loading.get(src)
  if (!promise) {
    promise = importEntry(src)
    loading.set(src, promise)
  }
  return promise
}

// The fallback stays: the browser lacks a feature, or the island animates and the reader asked for less motion
function stays(declaration: HeavyDeclaration): boolean {
  return missingFeatures(declaration.features as HeavyFeature[]).length > 0 || (declaration.motion === true && prefersReducedMotion())
}

async function ignore(task: Promise<unknown>): Promise<void> {
  try {
    await task
  } catch {
    // Aborted by a newer scan, or the entry did not load (the next scan tries again)
  }
}

async function loadWhenVisible(elements: HTMLElement[], src: string, signal: AbortSignal): Promise<void> {
  await Promise.any(elements.map(element => whenVisible(element, { signal })))
  // The entry may write into the light DOM of the page: it loads once Vue has hydrated
  await whenHydrated()
  await load(src)
}

// A control is part of the Vue markup: wait for hydration before touching it
async function arm(element: HTMLElement, declaration: HeavyDeclaration & { control: string }, signal: AbortSignal): Promise<void> {
  const control = element.querySelector<HTMLElement>(declaration.control)
  if (!control || armed.get(control)?.aborted === false || stays(declaration)) return
  armed.set(control, signal)
  await whenHydrated()
  // A newer scan, started while the page hydrated, arms the control itself
  if (signal.aborted) return
  // Save-Data keeps the control and says what pressing it costs (the server wrote both texts)
  const { saveDataLabel, saveDataAria } = element.dataset
  if (saveData() && saveDataLabel) {
    control.textContent = saveDataLabel
    if (saveDataAria) control.setAttribute('aria-label', saveDataAria)
  }
  control.hidden = false
  // Already imported (a client-side navigation): the entry upgrades the element and listens to the control by itself
  while (!imported.has(declaration.src)) {
    try {
      await whenInteracted(control, { events: ['click'], signal })
    } catch {
      // A newer scan (a navigation) replaced this wait: a control that stays on the page is armed again by it
      if (armed.get(control) === signal) armed.delete(control)
      return
    }
    // Another element imported the entry meanwhile: this press already reached the entry, do not repeat it
    if (imported.has(declaration.src)) break
    try {
      await load(declaration.src)
      element.removeAttribute('data-island-error')
      control.click()
    } catch {
      // The island shows its "unavailable" state; the next press tries again
      element.setAttribute('data-island-error', '')
    }
  }
}

function scan(): void {
  // A new scan replaces the waits of the previous page
  waiting?.abort()
  const controller = new AbortController()
  waiting = controller
  for (const script of document.querySelectorAll(`script[id^="${HEAVY_SCRIPT_PREFIX}"]`)) {
    const declaration = parseHeavyDeclaration(script.textContent)
    if (!declaration) continue
    const elements = Array.from(document.querySelectorAll<HTMLElement>(heavyTag(declaration.id)))
    if (declaration.control) {
      for (const element of elements) void ignore(arm(element, { ...declaration, control: declaration.control }, controller.signal))
      continue
    }
    // Save-Data keeps a `visible` island on its fallback unless the island opted in
    if (imported.has(declaration.src) || !elements.length || stays(declaration) || (declaration.saveData === 'skip' && saveData())) continue
    void ignore(loadWhenVisible(elements, declaration.src, controller.signal))
  }
}

document.addEventListener(HEAVY_SCAN_EVENT, scan)
scan()
