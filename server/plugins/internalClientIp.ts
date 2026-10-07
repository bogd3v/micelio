import { INTERNAL_IP_HEADER, INTERNAL_NONCE_HEADER, isInternalFetchTarget } from '../lib/clientIp'

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
    const original = event.$fetch
    event.$fetch = ((request, init) => {
      if (!isInternalFetchTarget(request)) return original(request, init)
      const headers = new Headers(init?.headers as HeadersInit | undefined)
      headers.set(INTERNAL_IP_HEADER, ip)
      headers.set(INTERNAL_NONCE_HEADER, INTERNAL_NONCE)
      // h3 spreads init.headers into an object, which would drop a Headers instance
      return original(request, { ...init, headers: Object.fromEntries(headers.entries()) })
    }) as typeof event.$fetch
  })
})
