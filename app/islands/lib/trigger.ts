// When a heavy island starts loading (ADR 0006, section 6). Each trigger returns a promise that rejects with an
// AbortError when `signal` aborts, and releases its listeners and observer either way.

export interface TriggerOptions {
  signal?: AbortSignal
}

export interface VisibleOptions extends TriggerOptions {
  /** IntersectionObserver `rootMargin`: how far outside the viewport still counts as visible. */
  rootMargin?: string
  /** Longest wait for an idle period after `load`, in ms. */
  idleTimeout?: number
}

export interface InteractionOptions extends TriggerOptions {
  events?: Array<'click' | 'keydown'>
}

// Keys that move focus or modify; they do not mean the reader is using the control
const PASSIVE_KEYS = new Set(['Tab', 'Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Escape', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown', 'Home', 'End'])
const FUNCTION_KEY = /^F\d{1,2}$/

function abortError(): DOMException {
  return new DOMException('The trigger was aborted', 'AbortError')
}

/** Resolves once the page has loaded and the browser is idle (a short timeout stands in for `requestIdleCallback`). */
export function whenIdle(options: VisibleOptions = {}): Promise<void> {
  const { signal, idleTimeout = 2000 } = options
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    let cancelIdle = (): void => {}

    function finish(): void {
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }
    function startIdle(): void {
      if (typeof requestIdleCallback === 'function') {
        const handle = requestIdleCallback(finish, { timeout: idleTimeout })
        cancelIdle = () => cancelIdleCallback(handle)
      } else {
        const handle = setTimeout(finish, 200)
        cancelIdle = () => clearTimeout(handle)
      }
    }
    function check(): void {
      if (document.readyState !== 'complete') return
      stopWaiting()
      startIdle()
    }
    function stopWaiting(): void {
      document.removeEventListener('readystatechange', check)
      window.removeEventListener('load', check)
    }
    function onAbort(): void {
      stopWaiting()
      cancelIdle()
      reject(abortError())
    }

    signal?.addEventListener('abort', onAbort, { once: true })
    if (document.readyState === 'complete') {
      startIdle()
    } else {
      document.addEventListener('readystatechange', check)
      window.addEventListener('load', check)
    }
  })
}

function intersects(element: Element, options: VisibleOptions): Promise<void> {
  const { signal, rootMargin = '200px' } = options
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())
    // Without an observer the element counts as visible: the island still loads, after load and idle
    if (typeof IntersectionObserver !== 'function') return resolve()
    const observer = new IntersectionObserver((entries) => {
      if (!entries.some(entry => entry.isIntersecting)) return
      observer.disconnect()
      signal?.removeEventListener('abort', onAbort)
      resolve()
    }, { rootMargin })
    function onAbort(): void {
      observer.disconnect()
      reject(abortError())
    }
    signal?.addEventListener('abort', onAbort, { once: true })
    observer.observe(element)
  })
}

/** `visible`: the element is in (or near) the viewport and the page has loaded and gone idle, so it never competes with the LCP. */
export async function whenVisible(element: Element, options: VisibleOptions = {}): Promise<void> {
  if (options.signal?.aborted) throw abortError()
  // One controller cancels the other half when either rejects
  const inner = new AbortController()
  const forward = (): void => inner.abort()
  options.signal?.addEventListener('abort', forward, { once: true })
  try {
    await Promise.all([whenIdle({ ...options, signal: inner.signal }), intersects(element, { ...options, signal: inner.signal })])
  } catch (error) {
    inner.abort()
    throw error
  } finally {
    options.signal?.removeEventListener('abort', forward)
  }
}

/** `interaction`: the first click, or key press that is not only navigation, on `target`. */
export function whenInteracted(target: EventTarget, options: InteractionOptions = {}): Promise<void> {
  const { signal, events = ['click', 'keydown'] } = options
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(abortError())

    function listener(event: Event): void {
      if (event instanceof KeyboardEvent && (PASSIVE_KEYS.has(event.key) || FUNCTION_KEY.test(event.key))) return
      cleanup()
      resolve()
    }
    function onAbort(): void {
      cleanup()
      reject(abortError())
    }
    function cleanup(): void {
      for (const name of events) target.removeEventListener(name, listener)
      signal?.removeEventListener('abort', onAbort)
    }

    for (const name of events) target.addEventListener(name, listener)
    signal?.addEventListener('abort', onAbort, { once: true })
  })
}
