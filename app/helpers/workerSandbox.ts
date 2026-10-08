// Network access a Worker must not keep once its runtime is loaded (ADR 0004, worker containment). The Worker's CSP is the
// second layer; this is the first, and it holds where a browser applies the policy late.

/** Globals that reach the network, other contexts or storage. */
export const NETWORK_GLOBALS: readonly string[] = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'WebTransport',
  'WebSocketStream',
  'EventSource',
  'importScripts',
  'SharedWorker',
  'Worker',
  'BroadcastChannel',
  'caches',
  'indexedDB',
  'StorageManager',
  'CacheStorage',
]

/** Members of `navigator` that reach storage, other contexts or the network. */
export const NAVIGATOR_MEMBERS: readonly string[] = ['storage', 'locks', 'serviceWorker', 'sendBeacon', 'connection', 'mediaDevices']

/**
 * Removes `names` from `scope` and from every object of its prototype chain (`fetch` lives on the prototype in browsers),
 * and leaves a non-writable `undefined` where one cannot be deleted. Returns the names that are gone.
 */
export function removeNetworkGlobals(scope: object, names: readonly string[] = NETWORK_GLOBALS): string[] {
  const removed: string[] = []
  const navigator = (scope as { navigator?: object }).navigator
  if (navigator) removeNetworkGlobals(navigator, NAVIGATOR_MEMBERS)
  for (const name of names) {
    for (let target: object | null = scope; target; target = Object.getPrototypeOf(target)) {
      if (!Object.hasOwn(target, name)) continue
      if (Reflect.deleteProperty(target, name)) continue
      try {
        Object.defineProperty(target, name, { value: undefined, writable: false, configurable: false })
      } catch {
        // Neither deleted nor redefined: the CSP is the layer for it
      }
    }
    if ((scope as Record<string, unknown>)[name] === undefined) removed.push(name)
  }
  return removed
}
