import { expect, test } from '@playwright/test'
import type { APIRequestContext, Frame, Page } from '@playwright/test'

// ADR 0019: the admin frames a draft of the frontend. The admin is a page on https://localhost (e2e/preview/admin-server.mjs), the frontend
// is on https://127.0.0.1: two sites, so the grant cookie is a third-party partitioned one. The same admin files on https://127.0.0.1 are the
// "stranger" origin. Both are served with a throwaway certificate (e2e/preview/tls.ts): Playwright's Linux WebKit stores no `Secure` cookie from
// an http page, first-party included. Needs the production build: the CSP that lets the admin frame a draft is only sent there.
const APP_PORT = Number(process.env.PREVIEW_APP_PORT ?? 3236)
const MOCK_PORT = Number(process.env.PREVIEW_MOCK_PORT ?? 4336)
const ADMIN_PORT = Number(process.env.PREVIEW_ADMIN_PORT ?? 4436)
const APP = `https://127.0.0.1:${APP_PORT}`
const ADMIN = `https://localhost:${ADMIN_PORT}`
const STRANGER = `https://127.0.0.1:${ADMIN_PORT}`
const ARTICLE_TITLE = 'Linux Server Hardening Guide, second edition'

interface Received {
  origin: string
  fromFrame: boolean
  data: { v: number, type: string, payload: { v: number[], documentId: string, locale: string | null, version: string } }
}

interface Binding {
  kind?: 'article' | 'page'
  documentId: string
  locale?: string
}

async function tokenFor(request: APIRequestContext, binding: Binding): Promise<string> {
  const response = await request.post(`http://127.0.0.1:${MOCK_PORT}/__mock/preview-token`, { data: { ...binding, adminOrigin: ADMIN } })
  return (await response.json() as { token: string }).token
}

/** Opens the admin page with a frame on `/_preview` for a fresh token, as the plugin's token route would hand it over. */
async function openAdmin(page: Page, request: APIRequestContext, binding: Binding, suffix = ''): Promise<Frame> {
  const token = await tokenFor(request, binding)
  await page.goto(`${ADMIN}/admin.html?src=${encodeURIComponent(`${APP}/_preview?token=${token}${suffix}`)}`)
  return draftFrame(page)
}

function draftFrame(page: Page): Frame {
  return page.frames().find(frame => frame !== page.mainFrame())!
}

const received = (page: Page): Promise<Received[]> => page.evaluate(() => (window as unknown as { received: Received[] }).received)

/** Waits until the frame has run its task queue, so a message posted before this call has been handled (or dropped). */
function settled(frame: Frame): Promise<void> {
  return frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))))
}

// Whether the engine sends the partitioned grant cookie inside a frame of another site, with its default settings (ADR 0019, section 7).
// WebKit blocks third-party cookies, partitioned ones included, so the frame tests below skip there. The second test of the next block ('is kept by
// every engine when the same address is a page of the site') shows it is the frame that WebKit refuses and not the harness: the same address as a
// page of the site keeps the cookie. That is the fallback of the amendment of 2026-10-26, the one 'the draft as a top-level page' pins.
// Every exchange with `/_preview` counts against `previewPerIp` (30 a minute for 127.0.0.1, `server/utils/rateLimit.ts`); a run makes 26, and the
// retries of CI add to them, so a test that reaches it should be counted.
const SENDS_PARTITIONED_COOKIE: Record<string, boolean> = { chromium: true, firefox: true, webkit: false }

/**
 * Opens the tab from the admin's page as the pane's button does, and waits until it has settled on the draft and Nuxt has hydrated it. Its first
 * response is not awaited: `Cross-Origin-Opener-Policy: same-origin` moves the tab to another browsing context group, and WebKit does not always
 * report the response of the page it leaves, while a reload begun before the move ends aborts. A reload begun while the page still hydrates aborts
 * too (Firefox: `NS_BINDING_ABORTED`; WebKit: `Frame load interrupted`), because the router and the messages of the locale are still settling.
 */
async function openTab(page: Page, request: APIRequestContext): Promise<Page> {
  const token = await tokenFor(request, { documentId: 'doc-linux', locale: 'en' })
  await page.goto(`${ADMIN}/admin.html?src=about:blank`)
  const [tab] = await Promise.all([
    page.context().waitForEvent('page'),
    page.evaluate((url) => { window.open(url, '_blank') }, `${APP}/_preview?token=${token}`),
  ])
  await tab.waitForURL(`${APP}/drafts/doc-linux?locale=en`)
  await tab.waitForLoadState('load')
  await hydrated(tab)
  return tab
}

/** Waits until Nuxt has hydrated the page of the production build, which exposes `useNuxtApp` on `window`. */
async function hydrated(page: Page): Promise<void> {
  await expect.poll(() => page.evaluate(() => (window as unknown as { useNuxtApp: () => { isHydrating: boolean } }).useNuxtApp().isHydrating)).toBe(false)
}

test.describe('the grant cookie, in a frame of another site and as a page of the site', () => {
  test('is sent by the engines that allow partitioned cookies and refused by the others, and the draft is never shown without it', async ({ page, request, browserName }, testInfo) => {
    const sent = SENDS_PARTITIONED_COOKIE[browserName]!
    const answered = page.waitForResponse(response => response.url().startsWith(`${APP}/drafts/`))
    const frame = await openAdmin(page, request, { documentId: 'doc-linux', locale: 'en' })
    const draft = await answered
    testInfo.annotations.push({ type: 'partitioned-cookie', description: `${browserName}: ${draft.status() === 200 ? 'sent' : 'refused'}` })
    expect(draft.status()).toBe(sent ? 200 : 404)
    expect(draft.headers()['content-security-policy']).toContain(sent ? `frame-ancestors ${ADMIN};` : 'frame-ancestors \'none\'')
    if (!sent) expect(draft.headers()['x-frame-options']).toBe('DENY')
    if (sent) await expect(frame.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
    else expect((await page.context().cookies()).map(cookie => cookie.name)).not.toContain('__Host-micelio_preview')
  })

  // A fresh token for the same address as above, opened as a page of the site: the cookie is first-party and every engine keeps it. Beside the refusal above it
  // tells WebKit's refusal of a cookie in a frame of another site from a harness that keeps no cookie at all
  test('is kept by every engine when the same address is a page of the site', async ({ page, request }) => {
    const token = await tokenFor(request, { documentId: 'doc-linux', locale: 'en' })
    const answered = page.waitForResponse(response => response.url().startsWith(`${APP}/drafts/`))
    await page.goto(`${APP}/_preview?token=${token}`)
    const draft = await answered
    expect(draft.status()).toBe(200)
    expect(draft.headers()['content-security-policy']).toContain(`frame-ancestors ${ADMIN};`)
    await expect(page.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
    expect((await page.context().cookies()).map(cookie => cookie.name)).toContain('__Host-micelio_preview')
  })
})

// The fallback of the amendment of 2026-10-26 for an engine that refuses the cookie in a frame: the admin opens `/_preview?token=…` as a tab, a page of the
// site, where the cookie is first-party
test.describe('the draft as a top-level page', () => {
  test('opens in a new tab with the grant cookie, reloads, and cuts the link to the admin that opened it', async ({ page, request }) => {
    const tab = await openTab(page, request)
    await expect(tab.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
    expect(tab.url()).toBe(`${APP}/drafts/doc-linux?locale=en`)
    expect((await page.context().cookies()).map(cookie => cookie.name)).toContain('__Host-micelio_preview')
    expect(await tab.evaluate(() => window.opener)).toBeNull()

    const reloaded = await tab.reload()
    expect(reloaded!.status()).toBe(200)
    expect(reloaded!.headers()['cross-origin-opener-policy']).toBe('same-origin')
    await expect(tab.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
  })

  test('is refused and cannot be framed once the cookie is cleared, as in the frame', async ({ page, request }) => {
    const tab = await openTab(page, request)
    await expect(tab.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
    await page.context().clearCookies()

    const reloaded = await tab.reload()
    expect(reloaded!.status()).toBe(404)
    expect(reloaded!.headers()['content-security-policy']).toContain('frame-ancestors \'none\'')
    expect(reloaded!.headers()['x-frame-options']).toBe('DENY')
  })
})

test.describe('the draft in the admin\'s frame', () => {
  test.skip(({ browserName }) => !SENDS_PARTITIONED_COOKIE[browserName], 'This engine refuses the grant cookie in a frame of another site: the test above pins it; the fallback is in \'the draft as a top-level page\' (amendment of 2026-10-26)')

  test('is opened with the grant cookie and says ready to the admin', async ({ page, request }) => {
    const frame = await openAdmin(page, request, { documentId: 'doc-linux', locale: 'en' })
    await expect(frame.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
    await expect.poll(async () => (await received(page)).map(message => message.data.type)).toEqual(['ready'])
    const [ready] = await received(page)
    expect(ready).toMatchObject({
      origin: APP,
      fromFrame: true,
      data: { v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-linux', locale: 'en', version: '2026-09-27T14:15:00.000Z' } },
    })
    // The token is gone from the frame's address, and the grant is not in the page
    expect(frame.url()).toBe(`${APP}/drafts/doc-linux?locale=en`)
    expect(await frame.content()).not.toContain('preview-grant-')
  })

  test('shows a page draft too, in Spanish with its prefix', async ({ page, request }) => {
    const frame = await openAdmin(page, request, { kind: 'page', documentId: 'doc-page-draft', locale: 'en' })
    await expect(frame.getByRole('heading', { level: 1 }).first()).toBeVisible()
    await expect.poll(async () => (await received(page)).map(message => message.data.payload.documentId)).toEqual(['doc-page-draft'])
    expect(frame.url()).toBe(`${APP}/drafts/pages/doc-page-draft?locale=en`)
  })

  test('loads the draft again on a load-draft from the admin, and says ready again', async ({ page, request }) => {
    const frame = await openAdmin(page, request, { documentId: 'doc-linux', locale: 'en' })
    await expect(frame.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
    await expect.poll(async () => (await received(page)).length).toBe(1)
    await frame.evaluate(() => document.documentElement.setAttribute('data-probe', 'first-load'))
    await page.evaluate(origin => (window as unknown as { send: (data: unknown, origin: string) => void }).send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-linux', locale: 'en' } }, origin), APP)
    await expect.poll(async () => (await received(page)).length).toBe(2)
    await expect(frame.locator('html')).not.toHaveAttribute('data-probe', 'first-load')
    await expect(frame.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
  })

  test('drops a message from another origin, from another window and any that fails the schema', async ({ page, request }) => {
    const frame = await openAdmin(page, request, { documentId: 'doc-linux', locale: 'en' })
    await expect(frame.getByRole('heading', { level: 1, name: ARTICLE_TITLE })).toBeVisible()
    await expect.poll(async () => (await received(page)).length).toBe(1)
    await frame.evaluate(() => document.documentElement.setAttribute('data-probe', 'first-load'))

    const sibling = (origin: string, query: string): string => `${origin}/sibling.html?target=${encodeURIComponent(APP)}&${query}`
    // The admin's origin but not the admin's window, and another origin altogether: each a valid load-draft for this document
    await page.evaluate(src => (window as unknown as { addSibling: (src: string) => Promise<void> }).addSibling(src), sibling(ADMIN, 'documentId=doc-linux&locale=en'))
    await page.evaluate(src => (window as unknown as { addSibling: (src: string) => Promise<void> }).addSibling(src), sibling(STRANGER, 'documentId=doc-linux&locale=en'))
    // The admin's window with a message that is not one: wrong version of the envelope, a bad payload, another document or locale, a message of the other direction
    const send = (data: unknown): Promise<void> => page.evaluate(([payload, origin]) => (window as unknown as { send: (data: unknown, origin: string) => void }).send(payload, origin), [data, APP] as const)
    await send({ v: 2, type: 'load-draft', payload: { documentId: 'doc-linux', locale: 'en' } })
    await send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-linux' } })
    await send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-draft-pihole', locale: 'es' } })
    await send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-linux', locale: 'es' } })
    await send({ v: 1, type: 'ready', payload: { v: [1], documentId: 'doc-linux', locale: 'en', version: 'x' } })
    await send({ v: 1, type: 'block-select', payload: { zone: 'sections', index: 0, block: 'hero', version: 'x' } })
    await send('load-draft')
    await settled(frame)
    await expect(frame.locator('html')).toHaveAttribute('data-probe', 'first-load')
    expect((await received(page)).length).toBe(1)

    // The right message still works, so the drops above were not a broken listener
    await send({ v: 1, type: 'load-draft', payload: { documentId: 'doc-linux', locale: 'en' } })
    await expect.poll(async () => (await received(page)).length).toBe(2)
  })

  test('posts ready only to the admin origin: a stranger that frames the same address hears nothing', async ({ page, request }) => {
    // The stranger's origin is not the one the grant is bound to: the browser refuses to frame the draft for it, and ready goes to the admin origin only
    const token = await tokenFor(request, { documentId: 'doc-linux', locale: 'en' })
    const answered = page.waitForResponse(response => response.url().startsWith(`${APP}/drafts/`))
    await page.goto(`${STRANGER}/admin.html?src=${encodeURIComponent(`${APP}/_preview?token=${token}`)}`)
    const draft = await answered
    expect(draft.headers()['content-security-policy']).toContain(`frame-ancestors ${ADMIN};`)
    await settled(page.mainFrame())
    expect(await received(page)).toEqual([])
  })
})

test.describe('the modes of the draft route', () => {
  test.skip(({ browserName }) => !SENDS_PARTITIONED_COOKIE[browserName], 'This engine refuses the grant cookie in a frame of another site: the cookie test pins it; the fallback is in \'the draft as a top-level page\' (amendment of 2026-10-26)')

  test('loads the islands of a page draft in the dynamic mode and leaves them on their static alternative in the static mode', async ({ page, request }) => {
    const islands: string[] = []
    page.on('request', (seen) => {
      if (seen.url().startsWith(`${APP}/_islands/`)) islands.push(seen.url())
    })
    const dynamic = await openAdmin(page, request, { kind: 'page', documentId: 'doc-page-draft', locale: 'en' })
    await expect(dynamic.locator('micelio-scene').first()).toBeAttached()
    await expect.poll(() => islands.length).toBeGreaterThan(0)
    // The scene is in the HTML before the page hydrates and says ready: a `ready` still to come when the next admin page begins to load reaches that page in
    // Firefox (as a message whose source is not its frame), and its count is then 2. Wait for the first one, so the page below hears only its own frame
    await expect.poll(async () => (await received(page)).length).toBe(1)

    islands.length = 0
    const staticMode = await openAdmin(page, request, { kind: 'page', documentId: 'doc-page-draft', locale: 'en' }, '&mode=static')
    await expect(staticMode.locator('micelio-scene').first()).toBeAttached()
    await expect.poll(async () => (await received(page)).length).toBe(1)
    await settled(staticMode)
    expect((await received(page)).map(message => [message.data.type, message.fromFrame])).toEqual([['ready', true]])
    expect(islands).toEqual([])
    expect(staticMode.url()).toBe(`${APP}/drafts/pages/doc-page-draft?locale=en&mode=static`)
  })
})

// The CMS measures a draft at publish with a grant it mints for itself (ADR 0019, amendment of 2026-10-25). No browser: the production build, over a socket,
// through the weight route, the draft page with its `editor` middleware and the draft API route, with no cookie
test.describe('the weight of a draft for a system grant', () => {
  async function systemGrant(request: APIRequestContext, binding: Binding): Promise<string> {
    const response = await request.post(`http://127.0.0.1:${MOCK_PORT}/__mock/preview-system-grant`, { data: binding })
    return (await response.json() as { grant: string }).grant
  }

  const weight = (request: APIRequestContext, grant: string, address: number) => request.get(`${APP}/api/preview/api%3A%3Apage.page/doc-page-draft/weight?locale=en&mode=static`, { headers: { 'x-micelio-preview-grant': grant, 'x-forwarded-for': `2001:db8:46:${address}::1` } })

  test('measures a page whole with one grant, and the grant is spent', async ({ request, browserName }) => {
    const address = ['chromium', 'firefox', 'webkit'].indexOf(browserName) + 1
    const grant = await systemGrant(request, { kind: 'page', documentId: 'doc-page-draft' })
    const measured = await weight(request, grant, address)
    expect(measured.status()).toBe(200)
    expect(measured.headers()['set-cookie']).toBeUndefined()
    expect(measured.headers()['content-security-policy']).toContain('frame-ancestors \'none\'')
    const report = (await measured.json() as { data: { blocks: unknown[], totalKb: number } }).data
    expect(report.blocks.length).toBeGreaterThanOrEqual(10)
    expect(report.totalKb).toBeGreaterThan(0)
    expect((await weight(request, grant, address)).status()).toBe(404)
  })

  test('is refused by the draft routes and shows nothing', async ({ request }) => {
    const grant = await systemGrant(request, { kind: 'page', documentId: 'doc-page-draft' })
    for (const path of ['/api/drafts/pages/doc-page-draft?locale=en', '/drafts/pages/doc-page-draft?locale=en']) {
      const response = await request.get(`${APP}${path}`, { headers: { 'cookie': `__Host-micelio_preview=${grant}`, 'x-micelio-preview-grant': grant } })
      expect(response.status(), path).toBe(404)
      expect(response.headers()['x-frame-options'], path).toBe('DENY')
    }
  })
})
