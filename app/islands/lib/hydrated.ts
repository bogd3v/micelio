// Islands that write into the light DOM of a Vue page wait for hydration, or Vue sees a mismatch (ADR 0006, section 6).
// `app/plugins/hydrated.client.ts` sets the flag and dispatches the event on `app:suspense:resolve`.
/** Name of the event that `document` receives once the Nuxt app has finished hydrating; `app/plugins/hydrated.client.ts` dispatches it. */
export const HYDRATED_EVENT = 'micelio:hydrated'
/** Name of the `window` property that the hydration plugin sets to `true` once the Nuxt app has finished hydrating. */
export const HYDRATED_FLAG = '__micelioHydrated'

interface HydratedWindow {
  [HYDRATED_FLAG]?: boolean
}

/** Longest wait, in ms: an app that never finishes hydrating must not leave the island dead. */
const HYDRATION_TIMEOUT = 15000

/** Resolves at once on a page without a Nuxt app (static, landing), otherwise when hydration has finished. */
export function whenHydrated(timeout: number = HYDRATION_TIMEOUT): Promise<void> {
  if (!document.getElementById('__NUXT_DATA__') || (window as HydratedWindow)[HYDRATED_FLAG]) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      if (typeof __MICELIO_DEV__ !== 'undefined' && __MICELIO_DEV__) console.warn('[micelio] whenHydrated() timed out; the page did not finish hydrating')
      done()
    }, timeout)
    function done(): void {
      clearTimeout(timer)
      document.removeEventListener(HYDRATED_EVENT, done)
      resolve()
    }
    document.addEventListener(HYDRATED_EVENT, done, { once: true })
  })
}
