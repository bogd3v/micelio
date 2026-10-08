// <micelio-scene>: draws the 3D model of a `scene` section over its poster (ADR 0006, section 6). The server markup holds the poster, which
// stays on any failure. The loader (`loader.ts`) imports this file when a scene nears the viewport after load and idle (and not under
// reduced motion, Save-Data or without WebGL2); Three.js and the model load on the first start. The canvas lives in a shadow root.
// It does not import `lib/features`, `lib/trigger` or `lib/hydrated`, which the loader shares: the checks below repeat the cheap ones,
// because an element created by a client-side navigation upgrades by itself.
import { glbProblem, isGlb, MODEL_MAX_BYTES, modelSource } from '../helpers/scene'
import type { SceneView } from './lib/sceneEngine'

const STYLE = `
:host { display: block; position: relative; }
canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; opacity: 0; }
:host([data-state="ready"]) canvas { opacity: 1; }
:host([data-state="ready"]) ::slotted(*) { visibility: hidden; }
`

async function ignore(task: Promise<unknown>): Promise<void> {
  try {
    await task
  } catch {
    // The element already shows its poster
  }
}

function saveData(): boolean {
  return (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true
}

// The whole body, or nothing: a file past the limit is cancelled while it downloads
async function download(url: URL, signal: AbortSignal): Promise<ArrayBuffer> {
  const response = await fetch(url, { signal, credentials: 'omit', referrerPolicy: 'no-referrer' })
  if (!response.ok || !response.body) throw new Error(`Model answered ${response.status}`)
  if (Number(response.headers.get('content-length')) > MODEL_MAX_BYTES) throw new Error('Model too large')
  const chunks: Uint8Array[] = []
  let size = 0
  const reader = response.body.getReader()
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.byteLength
    if (size > MODEL_MAX_BYTES) {
      await reader.cancel()
      throw new Error('Model too large')
    }
    chunks.push(value)
  }
  const bytes = new Uint8Array(size)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  if (!isGlb(bytes)) throw new Error('Not a .glb file')
  // Before Three.js allocates what the file asks for (a few bytes of JSON can ask for gigabytes)
  const problem = glbProblem(bytes.buffer)
  if (problem) throw new Error(problem)
  return bytes.buffer
}

class MicelioScene extends HTMLElement {
  // The media query outlives a stopped scene: turning motion back on restarts it
  private motionAbort: AbortController | undefined
  private abort: AbortController | undefined
  private observer: IntersectionObserver | undefined
  private resizer: ResizeObserver | undefined
  private canvas: HTMLCanvasElement | undefined
  private view: SceneView | undefined
  private starting = false
  private failed = false
  private near = false

  constructor() {
    super()
    const root = this.attachShadow({ mode: 'open' })
    const style = document.createElement('style')
    style.textContent = STYLE
    root.append(style, document.createElement('slot'))
  }

  connectedCallback(): void {
    if (this.motionAbort || saveData()) return
    const motion = matchMedia('(prefers-reduced-motion: reduce)')
    this.motionAbort = new AbortController()
    // Reduced motion switched on while the scene runs: back to the poster; switched off: it starts again
    motion.addEventListener('change', () => {
      this.stop()
      this.failed = false
      this.removeAttribute('data-state')
      this.removeAttribute('data-paused')
      if (!motion.matches) this.arm()
    }, { signal: this.motionAbort.signal })
    if (!motion.matches) this.arm()
  }

  // Watches the viewport and the tab; the scene starts when it is near and the tab is visible
  private arm(): void {
    if (this.abort) return
    this.abort = new AbortController()
    const { signal } = this.abort
    document.addEventListener('visibilitychange', this.sync, { signal })
    this.observer = new IntersectionObserver((entries) => {
      this.near = entries.at(-1)?.isIntersecting ?? false
      this.sync()
    }, { rootMargin: '100px' })
    this.observer.observe(this)
  }

  disconnectedCallback(): void {
    this.motionAbort?.abort()
    this.motionAbort = undefined
    this.stop()
    this.removeAttribute('data-state')
    this.removeAttribute('data-paused')
    this.failed = false
  }

  // Draws only while the scene is near the viewport and the tab is visible
  private sync = (): void => {
    const running = this.near && !document.hidden
    if (running && !this.view && !this.starting && !this.failed) void ignore(this.start())
    this.view?.run(running)
    this.toggleAttribute('data-paused', !running)
  }

  private fail(state: 'error' | 'lost'): void {
    this.stop()
    this.failed = true
    this.setAttribute('data-state', state)
  }

  private async start(): Promise<void> {
    const url = modelSource(this.dataset.model, location.href)
    const signal = this.abort?.signal
    if (!url || !signal) return this.fail('error')
    this.starting = true
    this.setAttribute('data-state', 'loading')
    try {
      const [engine, model] = await Promise.all([import('./lib/sceneEngine'), download(url, signal)])
      if (signal.aborted) return
      const canvas = document.createElement('canvas')
      canvas.setAttribute('role', 'img')
      canvas.setAttribute('aria-label', this.querySelector('img')?.alt ?? '')
      canvas.addEventListener('webglcontextlost', (event) => {
        event.preventDefault()
        this.fail('lost')
      }, { signal })
      this.shadowRoot?.append(canvas)
      this.canvas = canvas
      const view = await engine.createScene(canvas, model, () => {
        if (this.getAttribute('data-state') === 'loading') this.setAttribute('data-state', 'ready')
      })
      if (signal.aborted) {
        view.dispose()
        return
      }
      this.view = view
      this.resizer = new ResizeObserver(() => view.resize(this.clientWidth, this.clientHeight))
      this.resizer.observe(this)
      view.resize(this.clientWidth, this.clientHeight)
      this.sync()
    } catch {
      if (!signal.aborted) this.fail('error')
    } finally {
      this.starting = false
    }
  }

  // Releases the GPU, the listeners and the canvas; the poster is what remains
  private stop(): void {
    this.abort?.abort()
    this.abort = undefined
    this.observer?.disconnect()
    this.observer = undefined
    this.resizer?.disconnect()
    this.resizer = undefined
    this.view?.dispose()
    this.view = undefined
    this.canvas?.remove()
    this.canvas = undefined
    this.near = false
    this.starting = false
  }
}

if (!customElements.get('micelio-scene')) customElements.define('micelio-scene', MicelioScene)
