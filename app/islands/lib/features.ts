// Browser capabilities a heavy island checks before it loads (ADR 0006, section 6).
import type { HeavyFeature } from '../types'

interface NetworkInformation {
  saveData?: boolean
}

let webgl2: boolean | undefined

export function supportsWasm(): boolean {
  return typeof WebAssembly === 'object' && typeof WebAssembly.instantiate === 'function'
}

export function supportsWorker(): boolean {
  return typeof Worker === 'function'
}

/** Creates a context once and drops it with `WEBGL_lose_context` where available, so it does not count against the page's limit. */
export function supportsWebGL2(): boolean {
  if (webgl2 !== undefined) return webgl2
  try {
    const context = document.createElement('canvas').getContext('webgl2')
    context?.getExtension('WEBGL_lose_context')?.loseContext()
    webgl2 = context !== null && context !== undefined
  } catch {
    webgl2 = false
  }
  return webgl2
}

export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function saveData(): boolean {
  return (navigator as Navigator & { connection?: NetworkInformation }).connection?.saveData === true
}

const CHECKS: Record<HeavyFeature, () => boolean> = {
  wasm: supportsWasm,
  worker: supportsWorker,
  webgl2: supportsWebGL2,
}

/** The features of `required` this browser lacks; empty when the island can run. */
export function missingFeatures(required: readonly HeavyFeature[]): HeavyFeature[] {
  return required.filter(feature => !CHECKS[feature]?.())
}

/** Test hook: the WebGL2 answer is cached for the page. */
export function resetFeatureCache(): void {
  webgl2 = undefined
}
