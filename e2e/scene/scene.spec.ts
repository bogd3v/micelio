import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import sharp from 'sharp'
import { bombGlb, texturedGlb } from '../fixtures/glb.mjs'

// #246: the scene island on the dynamic build. The poster is what stays without JS, with reduced motion, Save-Data, without WebGL2 and
// after a context loss; Three.js (the sceneEngine chunk) and the model load only when the scene is visible after `load`.
const SHOWCASE = '/showcase'
const ENGINE = /\/_islands\/chunks\/sceneEngine-[\w-]+\.js/
const SCENE = 'micelio-scene'

// Records the WebGL2 contexts the page creates and how many draw calls it makes
const TRACK = (): void => {
  const w = window as unknown as { __gl: WebGL2RenderingContext[], __draws: number, __textures: Set<WebGLTexture>, __imageTextures: Set<WebGLTexture>, __textureCount: number }
  w.__gl = []
  w.__draws = 0
  w.__textures = new Set()
  w.__imageTextures = new Set()
  w.__textureCount = 0
  const create = WebGL2RenderingContext.prototype.createTexture
  WebGL2RenderingContext.prototype.createTexture = function (this: WebGL2RenderingContext): WebGLTexture {
    const texture = create.call(this)
    w.__textures.add(texture)
    w.__textureCount++
    return texture
  }
  // The textures that hold an image (the model's), told apart from the ones Three.js creates for itself
  for (const name of ['texImage2D', 'texSubImage2D'] as const) {
    const upload = WebGL2RenderingContext.prototype[name] as (...args: unknown[]) => void
    WebGL2RenderingContext.prototype[name] = function (this: WebGL2RenderingContext, ...args: unknown[]): void {
      const source = args.at(-1)
      if (source instanceof HTMLImageElement || source instanceof ImageBitmap) w.__imageTextures.add(this.getParameter(this.TEXTURE_BINDING_2D) as WebGLTexture)
      upload.apply(this, args)
    } as never
  }
  const remove = WebGL2RenderingContext.prototype.deleteTexture
  WebGL2RenderingContext.prototype.deleteTexture = function (this: WebGL2RenderingContext, texture: WebGLTexture | null): void {
    if (texture) w.__textures.delete(texture)
    remove.call(this, texture)
  }
  const original = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, kind: string, options?: unknown) => RenderingContext | null
  HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: unknown): RenderingContext | null {
    const context = original.call(this, kind, options)
    if (kind === 'webgl2' && context) w.__gl.push(context as WebGL2RenderingContext)
    return context
  } as typeof HTMLCanvasElement.prototype.getContext
  for (const name of ['drawArrays', 'drawElements'] as const) {
    const draw = WebGL2RenderingContext.prototype[name] as (...args: unknown[]) => void
    WebGL2RenderingContext.prototype[name] = function (this: WebGL2RenderingContext, ...args: unknown[]): void {
      w.__draws++
      draw.apply(this, args)
    } as never
  }
}

async function track(page: Page): Promise<void> {
  await page.addInitScript(TRACK)
}

const liveContexts = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __gl: WebGL2RenderingContext[] }).__gl.filter(gl => !gl.isContextLost()).length)
// `images`: textures that were given an image; `live`: how many of those are still not deleted
const textures = (page: Page): Promise<{ images: number, live: number }> => page.evaluate(() => {
  const w = window as unknown as { __textures: Set<unknown>, __imageTextures: Set<unknown> }
  return { images: w.__imageTextures.size, live: [...w.__imageTextures].filter(texture => w.__textures.has(texture)).length }
})
const draws = (page: Page): Promise<number> => page.evaluate(() => (window as unknown as { __draws: number }).__draws)

async function hasWebGL2(page: Page): Promise<boolean> {
  return page.evaluate(() => {
    const gl = document.createElement('canvas').getContext('webgl2')
    gl?.getExtension('WEBGL_lose_context')?.loseContext()
    return gl !== null
  })
}

function engineRequests(page: Page): string[] {
  const urls: string[] = []
  page.on('request', (request) => {
    if (ENGINE.test(request.url()) || request.url().endsWith('.glb')) urls.push(request.url())
  })
  return urls
}

/** The showcase's scene is its last section: bring it into view and wait for the island to take over (or not). */
async function toScene(page: Page): Promise<void> {
  await page.goto(SHOWCASE, { waitUntil: 'load' })
  await page.locator(SCENE).scrollIntoViewIfNeeded()
}

test.describe('with WebGL2', () => {
  test.beforeEach(async ({ page, browserName }) => {
    await track(page)
    await page.goto('/blog')
    test.skip(!(await hasWebGL2(page)), `${browserName} headless has no WebGL2 here: only the fallback paths run`)
  })

  test('draws the model over the poster and keeps the alt text on the canvas', async ({ page }) => {
    await toScene(page)
    const scene = page.locator(SCENE)
    await expect(scene).toHaveAttribute('data-state', 'ready')
    // The canvas is in the shadow root, labelled like the poster
    const label = await scene.evaluate(element => element.shadowRoot?.querySelector('canvas')?.getAttribute('aria-label'))
    expect(label).toBe('A green triangle')
    await expect(scene.locator('img')).toHaveCSS('visibility', 'hidden')
    // The triangle is green: some pixels of the stage are, and not the poster's
    await page.waitForTimeout(300)
    const { data } = await sharp(await scene.screenshot()).removeAlpha().raw().toBuffer({ resolveWithObject: true })
    let green = 0
    for (let index = 0; index < data.length; index += 3) {
      if (data[index + 1]! > data[index]! + 60 && data[index + 1]! > data[index + 2]! + 40) green++
    }
    expect(green).toBeGreaterThan(500)
  })

  test('has no CSP violation while it loads the model and Three.js', async ({ page }) => {
    const violations: string[] = []
    page.on('console', (message) => {
      if (/content security policy|refused to/i.test(message.text())) violations.push(message.text())
    })
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => console.error(`csp ${event.violatedDirective} ${event.blockedURI}`)))
    await toScene(page)
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    expect(violations).toEqual([])
  })

  test('pauses off the viewport and resumes when it comes back', async ({ page }) => {
    await toScene(page)
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-paused')
    await page.evaluate(() => window.scrollTo(0, 0))
    await expect(page.locator(SCENE)).toHaveAttribute('data-paused', '')
    await page.waitForTimeout(150)
    const stopped = await draws(page)
    await page.waitForTimeout(600)
    expect(await draws(page)).toBe(stopped)
    await page.locator(SCENE).scrollIntoViewIfNeeded()
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-paused')
    await expect.poll(() => draws(page)).toBeGreaterThan(stopped)
  })

  test('pauses when the tab is hidden and resumes when it is shown', async ({ page }) => {
    await toScene(page)
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    const hide = (hidden: boolean): Promise<void> => page.evaluate((value) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => value })
      document.dispatchEvent(new Event('visibilitychange'))
    }, hidden)
    await hide(true)
    await expect(page.locator(SCENE)).toHaveAttribute('data-paused', '')
    await page.waitForTimeout(150)
    const stopped = await draws(page)
    await page.waitForTimeout(600)
    expect(await draws(page)).toBe(stopped)
    await hide(false)
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-paused')
    await expect.poll(() => draws(page)).toBeGreaterThan(stopped)
  })

  test('shows the poster again when the WebGL context is lost', async ({ page }) => {
    await toScene(page)
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    await page.evaluate(() => {
      const gl = (window as unknown as { __gl: WebGL2RenderingContext[] }).__gl.find(context => !context.isContextLost())
      gl?.getExtension('WEBGL_lose_context')?.loseContext()
    })
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'lost')
    expect(await page.locator(SCENE).evaluate(element => element.shadowRoot?.querySelector('canvas'))).toBeNull()
    await expect(page.locator(SCENE).locator('img')).toHaveCSS('visibility', 'visible')
    expect(await liveContexts(page)).toBe(0)
  })

  test('releases the GPU on every client navigation away and back (no leak)', async ({ page }) => {
    const ROUNDS = 5
    await page.goto(SHOWCASE, { waitUntil: 'load' })
    for (let round = 0; round < ROUNDS; round++) {
      await page.locator(SCENE).scrollIntoViewIfNeeded()
      await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
      expect(await liveContexts(page), `round ${round}: one scene, one context`).toBe(1)
      await page.evaluate(() => {
        ;(window as unknown as { __left: Element }).__left = document.querySelector('micelio-scene')!
        return (window as unknown as { useNuxtApp: () => { $router: { push: (path: string) => Promise<void> } } }).useNuxtApp().$router.push('/blog')
      })
      await expect(page).toHaveURL(/\/blog$/)
      await expect.poll(() => liveContexts(page), { message: `round ${round}: contexts after leaving` }).toBe(0)
      // The element that left the page keeps no canvas in its shadow root: dispose removed it (querySelectorAll cannot see in there)
      expect(await page.evaluate(() => {
        const left = (window as unknown as { __left: HTMLElement }).__left
        return { canvas: left.shadowRoot?.querySelector('canvas') ?? null, state: left.getAttribute('data-state') }
      }), `round ${round}: the scene that left`).toEqual({ canvas: null, state: null })
      await page.evaluate(() => (window as unknown as { useNuxtApp: () => { $router: { push: (path: string) => Promise<void> } } }).useNuxtApp().$router.push('/showcase'))
      await expect(page).toHaveURL(/\/showcase$/)
    }
    // Five scenes were drawn in one page without more than one context alive at a time
    expect(await page.evaluate(() => (window as unknown as { __gl: unknown[] }).__gl.length)).toBeGreaterThanOrEqual(ROUNDS)
  })
})

test.describe('with WebGL2, a model with an image', () => {
  test.beforeEach(async ({ page, browserName }) => {
    await track(page)
    await page.goto('/blog')
    test.skip(!(await hasWebGL2(page)), `${browserName} headless has no WebGL2 here`)
  })

  test('draws with its embedded texture and no CSP violation (data: images, no blob:)', async ({ page }) => {
    const violations: string[] = []
    await page.addInitScript(() => document.addEventListener('securitypolicyviolation', event => console.error(`csp ${event.violatedDirective} ${event.blockedURI}`)))
    page.on('console', (message) => {
      // The inline onerror of @nuxt/image's pictures is not the island's (static builds strip it; ADR 0004)
      if ((/^csp /.test(message.text()) || /content security policy|refused to/i.test(message.text())) && !message.text().includes('script-src-attr')) violations.push(message.text())
    })
    await page.goto('/scene-hero', { waitUntil: 'load' })
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    expect((await textures(page)).images).toBeGreaterThan(0)
    expect(violations).toEqual([])
  })

  test('releases the texture when the scene goes away', async ({ page }) => {
    await page.goto('/scene-hero', { waitUntil: 'load' })
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    const { images, live } = await textures(page)
    expect(images).toBeGreaterThan(0)
    expect(live).toBe(images)
    await page.evaluate(() => (window as unknown as { useNuxtApp: () => { $router: { push: (path: string) => Promise<void> } } }).useNuxtApp().$router.push('/blog'))
    await expect(page).toHaveURL(/\/blog$/)
    await expect.poll(async () => (await textures(page)).live).toBe(0)
    expect(await liveContexts(page)).toBe(0)
  })

  test('ends on the poster for a model whose accessors ask for gigabytes', async ({ page }) => {
    await page.route('**/uploads/triangle.glb', route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', headers: { 'access-control-allow-origin': '*' }, body: bombGlb() }))
    await toScene(page)
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'error')
    await expect(page.locator(SCENE).locator('img')).toHaveCSS('visibility', 'visible')
    expect(await page.locator(SCENE).evaluate(element => element.shadowRoot?.querySelector('canvas'))).toBeNull()
    expect(await liveContexts(page)).toBe(0)
  })

  test('ends on the poster for a model whose image lives outside the file', async ({ page }) => {
    await page.route('**/uploads/triangle.glb', route => route.fulfill({ status: 200, contentType: 'model/gltf-binary', headers: { 'access-control-allow-origin': '*' }, body: texturedGlb({ imageUri: 'https://evil.example/x.png' }) }))
    const outside: string[] = []
    page.on('request', request => outside.push(request.url()))
    await toScene(page)
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'error')
    expect(outside.filter(url => url.includes('evil.example'))).toEqual([])
  })

  test('starts again when reduced motion is turned off', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await toScene(page)
    await page.waitForTimeout(1500)
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-state')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    // The loader never imported the island under reduced motion: it needs a scan of its own, which a client navigation gives
    await page.evaluate(() => document.dispatchEvent(new Event('micelio:heavy-scan')))
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-state')
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await expect(page.locator(SCENE)).toHaveAttribute('data-state', 'ready')
  })
})

test.describe('the poster stays and Three.js is not downloaded', () => {
  test('with prefers-reduced-motion: reduce', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' })
    const page = await context.newPage()
    const urls = engineRequests(page)
    await toScene(page)
    await page.waitForTimeout(2500)
    expect(urls).toEqual([])
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-state')
    await expect(page.locator(SCENE).locator('img')).toBeVisible()
    await context.close()
  })

  test('with Save-Data', async ({ page }) => {
    await page.addInitScript(() => Object.defineProperty(navigator, 'connection', { configurable: true, value: { saveData: true } }))
    const urls = engineRequests(page)
    await toScene(page)
    await page.waitForTimeout(2500)
    expect(urls).toEqual([])
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-state')
    await expect(page.locator(SCENE).locator('img')).toBeVisible()
  })

  test('without WebGL2', async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext as (this: HTMLCanvasElement, kind: string, options?: unknown) => RenderingContext | null
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, kind: string, options?: unknown): RenderingContext | null {
        return kind === 'webgl2' ? null : original.call(this, kind, options)
      } as typeof HTMLCanvasElement.prototype.getContext
    })
    const urls = engineRequests(page)
    await toScene(page)
    await page.waitForTimeout(2500)
    expect(urls).toEqual([])
    await expect(page.locator(SCENE)).not.toHaveAttribute('data-state')
    await expect(page.locator(SCENE).locator('img')).toBeVisible()
  })

  test('without JavaScript', async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false })
    const page = await context.newPage()
    await page.goto(SHOWCASE)
    await expect(page.locator(SCENE).locator('img')).toHaveAttribute('alt', 'A green triangle')
    await context.close()
  })

  test('on a scene below the fold nothing loads until it is near', async ({ page }) => {
    const urls = engineRequests(page)
    await page.goto(SHOWCASE, { waitUntil: 'load' })
    await page.waitForTimeout(2500)
    expect(urls).toEqual([])
  })
})

test('a scene that opens the page loads nothing of its own before load, and its poster is the LCP element', async ({ page }) => {
  await page.goto('/blog')
  test.skip(!(await page.evaluate(() => PerformanceObserver.supportedEntryTypes.includes('largest-contentful-paint'))), 'This browser has no Largest Contentful Paint API')
  await page.addInitScript(() => {
    const w = window as unknown as { __lcp: string[], __loadAt: number }
    w.__lcp = []
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) w.__lcp.push((entry as unknown as { element?: Element }).element?.tagName ?? '')
    }).observe({ type: 'largest-contentful-paint', buffered: true })
    window.addEventListener('load', () => (w.__loadAt = performance.now()))
  })
  const early: string[] = []
  let loaded = false
  page.on('request', (request) => {
    if (!loaded && (ENGINE.test(request.url()) || request.url().endsWith('.glb') || /\/_islands\/scene-/.test(request.url()))) early.push(request.url())
  })
  page.on('load', () => (loaded = true))
  await page.goto('/scene-hero', { waitUntil: 'load' })
  expect(early).toEqual([])
  const poster = page.locator(SCENE).locator('img')
  await expect(poster).toHaveAttribute('fetchpriority', 'high')
  // The observer delivers its entries after `load`, and a poster decoded asynchronously reports late: poll for the final candidate
  await expect.poll(() => page.evaluate(() => (window as unknown as { __lcp: string[] }).__lcp.at(-1))).toBe('IMG')
  // After load and idle the island arrives (where the browser has WebGL2)
  if (await hasWebGL2(page)) await expect(page.locator(SCENE)).toHaveAttribute('data-state', /loading|ready/)
})
