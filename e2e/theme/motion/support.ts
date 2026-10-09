import type { Locator, Page } from '@playwright/test'
import { testUsers } from '../../fixtures/auth.mjs'
import { NON_MOTION_ANIMATIONS } from '../../fixtures/motion'
import { openPage, type ThemePage } from '../support'

// The pages of the motion projects: the theme pages plus a section page in each locale (docs/theme-testing.md)
export const MOTION_PAGES: ThemePage[] = [
  { name: 'home', path: '/' },
  { name: 'blog', path: '/blog' },
  { name: 'article', path: '/blog/understanding-vue-composables' },
  { name: 'about', path: '/about' },
  { name: 'section page', path: '/showcase' },
  { name: 'section page (es)', path: '/es/muestra' },
  { name: 'specimen', path: '/_theme' },
]

// The native features the site uses behind a fallback (ADR 0005, section 10), as CSS names them
const CSS_FEATURES = ['animation-timeline', 'animation-range', 'view-timeline', 'scroll-timeline', 'anchor-name', 'position-anchor', 'position-area', 'position-try-fallbacks', '@view-transition', '@starting-style']

/** Console errors and page errors, except the failed image loads (blocked hosts, the mock's CORS) and the CSP report of the image onerror handler that follows (a finding, docs/theme-testing.md) */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(`pageerror: ${error.message}`))
  page.on('console', (message) => {
    if (message.type() !== 'error' || /Failed to load resource|NS_ERROR|net::ERR|blocked by CORS policy|inline event handler|script-src-attr/.test(message.text())) return
    errors.push(`console: ${message.text()}`)
  })
  return errors
}

function renameFeatures(css: string): string {
  return CSS_FEATURES.reduce((result, name) => result.replaceAll(name, `x-off-${name.replace('@', '')}`), css)
}

/** In a document only the `<style>` blocks and `style` attributes: the text and the payload stay as they are */
function renameInDocument(html: string): string {
  return html
    .replace(/(<style[^>]*>)([^]*?)(<\/style>)/g, (_all, open: string, css: string, close: string) => open + renameFeatures(css) + close)
    .replace(/ style="([^"]*)"/g, (_all, css: string) => ` style="${renameFeatures(css)}"`)
}

/**
 * No browser lets the tests switch off scroll timelines, view transitions, anchor positioning or `@starting-style`
 * where it ships them (Chromium has no flag for a stable feature). This makes the page see a browser that does not
 * know them: the CSS names are renamed in the stylesheets and the HTML, so `@supports` is false and the declarations
 * are dropped, and the JS entry points are deleted. The Popover API stays: nothing switches it off.
 */
export async function disableNativeMotionApis(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Reflect.deleteProperty(Document.prototype, 'startViewTransition')
    for (const name of ['ScrollTimeline', 'ViewTimeline', 'CSSViewTransitionRule']) Reflect.deleteProperty(window, name)
    const supports = CSS.supports.bind(CSS)
    // Vue patches inline styles after mount (`style.anchorName = …`, `setProperty`): drop what an unsupporting browser would
    const dropped = /^(animation-timeline|animation-range|view-timeline|scroll-timeline|anchor-name|position-anchor|position-area|position-try)/
    const dashed = (name: string): string => name.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`)
    const setProperty = CSSStyleDeclaration.prototype.setProperty
    CSSStyleDeclaration.prototype.setProperty = function (name: string, ...rest: [string | null, string?]) {
      return dropped.test(dashed(name)) ? undefined : setProperty.call(this, name, ...rest)
    }
    for (const name of ['animationTimeline', 'animationRange', 'viewTimeline', 'scrollTimeline', 'anchorName', 'positionAnchor', 'positionArea', 'positionTryFallbacks']) {
      for (const key of [name, dashed(name)]) Object.defineProperty(CSSStyleDeclaration.prototype, key, { configurable: true, get: () => '', set: () => undefined })
    }
    CSS.supports = ((...args: string[]) => /animation-timeline|view-timeline|scroll-timeline|anchor-name|position-anchor|position-area|position-try/.test(args.join(' ')) ? false : supports(...(args as [string, string]))) as typeof CSS.supports
  })
  await page.route(url => url.hostname === '127.0.0.1', async (route) => {
    const type = route.request().resourceType()
    if (type !== 'stylesheet' && type !== 'document') return route.fallback()
    const response = await route.fetch()
    const body = await response.text()
    await route.fulfill({ response, body: type === 'document' ? renameInDocument(body) : renameFeatures(body) })
  })
}

/** Scrolls the page from top to bottom in viewport steps, as a reader would, and back to the top */
export async function scrollThrough(page: Page): Promise<void> {
  const height = await page.evaluate(() => document.documentElement.scrollHeight)
  const step = (page.viewportSize()?.height ?? 800) * 0.8
  for (let y = 0; y < height; y += step) {
    await page.evaluate(top => window.scrollTo(0, top), y)
    await page.waitForTimeout(30)
  }
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
  await page.waitForTimeout(100)
}

/** Opens a page of the matrix once the network is quiet. The privacy notice would cover content. */
export async function open(page: Page, entry: ThemePage): Promise<void> {
  await page.addInitScript(() => localStorage.setItem('micelio-privacy-notice', '1'))
  await openPage(page, entry)
}

/** The mock Strapi accepts `mock-jwt-<id>` as a session (e2e/native-ui/dialogs.spec.ts) */
export async function signInAsReader(page: Page, baseURL: string | undefined): Promise<void> {
  await page.context().addCookies([{ name: 'micelio_session', value: 'mock-jwt-101', url: baseURL!, httpOnly: true, secure: true, sameSite: 'Lax' }])
}

export function accountToggle(page: Page): Locator {
  return page.getByRole('button', { name: `Your account menu, ${testUsers.reader.username}` }).first()
}

// NON_MOTION_ANIMATIONS (e2e/fixtures/motion.ts) run under reduce on purpose: a counter value and a one-step reveal.
/** The animations that exist (running, paused, or finished with a fill) and move something, described: a failure shows what ran, not only how many */
export async function runningAnimations(page: Page): Promise<string[]> {
  return page.evaluate(allowed => document.getAnimations().filter(animation => !allowed.includes((animation as CSSAnimation).animationName)).map((animation) => {
    const effect = animation.effect as KeyframeEffect | null
    const target = effect?.target ?? null
    const name = (animation as CSSAnimation).animationName ?? (animation as CSSTransition).transitionProperty ?? animation.id
    const classes = target && typeof target.className === 'string' && target.className.trim() ? `.${target.className.trim().split(/\s+/).join('.')}` : ''
    return `${animation.constructor.name} ${name} on ${target ? target.tagName.toLowerCase() + classes : '?'}${effect?.pseudoElement ?? ''}`
  }), NON_MOTION_ANIMATIONS)
}
