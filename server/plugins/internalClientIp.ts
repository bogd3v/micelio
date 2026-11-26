import { isInternalFetchTarget } from '../lib/clientIp'
import { INTERNAL_IP_HEADER, INTERNAL_NONCE_HEADER } from '../lib/constants'

/** `event.$fetch` as the wrapper calls it. Typed loosely through `unknown`: comparing a function with Nitro's route types can hit TypeScript's depth limit (#993). */
type InProcessFetch = (request: unknown, init?: { headers?: unknown }) => unknown

/**
 * SSR calls /api/* in process, with no socket address, so the visitor would be
 * `unknown` there. `event.$fetch` (what `useRequestFetch` and `useFetch` use)
 * carries the address the outer request resolved, with this process's nonce,
 * but only for relative paths: an absolute URL would send it to another host.
 * `clientIp()` accepts it only from a call without a socket address.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('request', (event) => {
    const ip = clientIp(event)
    const original = event.$fetch as unknown as InProcessFetch
    const wrapped: InProcessFetch = (request, init) => {
      if (!isInternalFetchTarget(request)) return original(request, init)
      const headers = new Headers(init?.headers as HeadersInit | undefined)
      headers.set(INTERNAL_IP_HEADER, ip)
      headers.set(INTERNAL_NONCE_HEADER, INTERNAL_NONCE)
      // h3 spreads init.headers into an object, which would drop a Headers instance
      return original(request, { ...init, headers: Object.fromEntries(headers.entries()) })
    }
    event.$fetch = wrapped as unknown as typeof event.$fetch
  })
})
