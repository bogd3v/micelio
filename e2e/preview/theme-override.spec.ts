import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page, Response } from '@playwright/test'
import type { ThemeStatus } from '../../app/interfaces/theme'

// The theme override of a preview token (ADR 0019, amendment of 2026-11-25, bogd3v/micelio#736). The mock CMS binds `theme` to the token, answers it on the
// exchange and on every draft read of its grant, as micelio-plugin-core does (bogd3v/micelio-plugin-core#268). The site's theme is bogota, the default the
// build pulls (themes.lock.json); starter is the other theme of the built-in store. The draft is opened as a page of the site, where the grant cookie is
// first-party, so every engine runs these tests (the frame is preview.spec.ts's). Needs the production build (`npm run theme:pull -- --frozen`, then `npm run build`).
const APP_PORT = Number(process.env.PREVIEW_APP_PORT ?? 3236)
const MOCK_PORT = Number(process.env.PREVIEW_MOCK_PORT ?? 4336)
const ADMIN_PORT = Number(process.env.PREVIEW_ADMIN_PORT ?? 4436)
const APP = `https://127.0.0.1:${APP_PORT}`
const MOCK = `http://127.0.0.1:${MOCK_PORT}`
const ADMIN = `https://localhost:${ADMIN_PORT}`
const SEEDED_PAGE = { kind: 'page', documentId: 'doc-page-draft', locale: 'en' } as const
const DRAFT_URL = `${APP}/drafts/pages/doc-page-draft?locale=en`
const STYLESHEET = /<link rel="stylesheet" href="\/_t\/([0-9a-f]+)\/theme\.css">/

interface Wanted { id: string, version: string }

// Every exchange with `/_preview` counts against `previewPerIp` (30 a minute for one address, `server/utils/rateLimit.ts`): each test comes from an address of its own
let opened = 0
function address(): string {
  return `2001:db8:736:${test.info().parallelIndex}:${++opened}::1`
}

async function status(request: APIRequestContext): Promise<ThemeStatus> {
  return (await request.get(`${APP}/api/theme/status`)).json() as Promise<ThemeStatus>
}

/** The theme the image was built with under `id`, at its version. */
async function builtIn(request: APIRequestContext, id: string): Promise<Wanted> {
  const listed = (await status(request)).available.builtIn.find(theme => theme.id === id)
  expect(listed, `${id} is in the built-in store`).toBeDefined()
  return { id, version: listed!.version ?? '' }
}

async function tokenFor(request: APIRequestContext, theme?: Wanted): Promise<string> {
  const response = await request.post(`${MOCK}/__mock/preview-token`, { data: { ...SEEDED_PAGE, adminOrigin: ADMIN, ...(theme && { theme }) } })
  return (await response.json() as { token: string }).token
}

/** Opens `/_preview` for a fresh token as a page of the site and returns the draft's response, once the page has settled on it. */
async function openDraft(page: Page, request: APIRequestContext, theme?: Wanted): Promise<Response> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': address() })
  // Leave the draft first: a redirect to the address the page is already on would let the wait below pass on the old document. Start with no grant either:
  // Firefox sometimes sends the draft request after the 303 with the grant cookie it had before, not the one the 303 sets, so a second preview would show the first one's theme
  await page.goto('about:blank')
  await page.context().clearCookies({ name: '__Host-micelio_preview' })
  const token = await tokenFor(request, theme)
  const answered = page.waitForResponse(response => response.url() === DRAFT_URL)
  await page.goto(`${APP}/_preview?token=${token}`)
  await page.waitForURL(DRAFT_URL)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  return answered
}

/** The digest of the theme stylesheet a page links, and the theme the payload hands the client. */
async function renderedTheme(page: Page): Promise<{ digest: string, id: string, defaultSlots: boolean }> {
  const digest = STYLESHEET.exec(await page.content())?.[1] ?? ''
  const data = await page.evaluate(() => (window as unknown as { useNuxtApp: () => { payload: { state: Record<string, { id: string, defaultSlots?: boolean }> } } }).useNuxtApp().payload.state['$smyc-theme-data']!)
  return { digest, id: data.id, defaultSlots: data.defaultSlots === true }
}

/** What a visitor gets for a public page: its status, its cache header and the stylesheet it links. */
async function publicView(request: APIRequestContext, path: string): Promise<{ status: number, cacheControl: string | undefined, stylesheet: string | undefined }> {
  const response = await request.get(`${APP}${path}`, { headers: { 'x-forwarded-for': address() } })
  return { status: response.status(), cacheControl: response.headers()['cache-control'], stylesheet: STYLESHEET.exec(await response.text())?.[1] }
}

test.describe('a theme override bound to the preview token', () => {
  test('renders the seeded page draft with starter under a theme override and with bogota without one', async ({ page, request }) => {
    const active = (await status(request)).active
    expect(active.id).toBe('bogota')

    const draft = await openDraft(page, request, await builtIn(request, 'starter'))
    expect(draft.status()).toBe(200)
    expect(draft.headers()['cache-control']).toContain('no-store')
    expect(draft.headers()['x-micelio-theme-preview']).toBeUndefined()
    const starter = await renderedTheme(page)
    // starter is built into the image: its own slots, and no rebuild to activate it
    expect(starter).toMatchObject({ id: 'starter', defaultSlots: false })
    expect(starter.digest).toMatch(/^[0-9a-f]+$/)
    expect(starter.digest).not.toBe(active.digest)
    // /_t/ serves the stylesheet a valid preview names
    expect((await page.request.get(`${APP}/_t/${starter.digest}/theme.css`)).status()).toBe(200)
    // Every load reads the override from the CMS again: a reload keeps it
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect((await renderedTheme(page)).id).toBe('starter')
    // The override is in no cookie: the grant cookie holds the grant alone
    for (const cookie of await page.context().cookies()) expect(`${cookie.name}=${cookie.value}`).not.toMatch(/starter|theme/)

    const plain = await openDraft(page, request)
    expect(plain.status()).toBe(200)
    expect(await renderedTheme(page)).toEqual({ digest: active.digest, id: 'bogota', defaultSlots: false })
  })

  test('keeps the public page on bogota, with the same stylesheet and cache headers, before, during and after a preview with starter', async ({ page, request }) => {
    const paths = ['/', '/showcase']
    const before = await Promise.all(paths.map(path => publicView(request, path)))
    const statusBefore = await status(request)
    for (const view of before) {
      expect(view.status).toBe(200)
      expect(view.stylesheet).toBe(statusBefore.active.digest)
    }

    await openDraft(page, request, await builtIn(request, 'starter'))
    expect((await renderedTheme(page)).id).toBe('starter')
    // During: a visitor, and the same browser with the grant cookie, get the public page as before
    expect(await Promise.all(paths.map(path => publicView(request, path)))).toEqual(before)
    expect(await Promise.all(paths.map(path => publicView(page.request, path)))).toEqual(before)
    expect(await status(request)).toEqual(statusBefore)

    // After: the preview is left, and nothing it rendered stayed behind
    await page.goto(`${APP}/showcase`)
    expect(STYLESHEET.exec(await page.content())?.[1]).toBe(statusBefore.active.digest)
    expect(await Promise.all(paths.map(path => publicView(request, path)))).toEqual(before)
    expect(await status(request)).toEqual(statusBefore)
  })

  test('answers themeNotInstalled for a theme override that is in no store, and installs nothing', async ({ request }) => {
    const statusBefore = await status(request)
    const starter = await builtIn(request, 'starter')
    for (const [theme, accept] of [[{ id: 'absent', version: '1.0.0' }, 'application/json'], [{ id: 'starter', version: `${starter.version}-other` }, 'text/html']] as const) {
      const token = await tokenFor(request, theme)
      const response = await request.get(`${APP}/_preview?token=${token}`, { headers: { accept, 'x-forwarded-for': address() }, maxRedirects: 0 })
      expect(response.status(), theme.id).toBe(409)
      expect(response.headers()['content-type'], theme.id).toContain('application/problem+json')
      expect(await response.json(), theme.id).toMatchObject({ status: 409, code: 'themeNotInstalled' })
      // No grant cookie, so the draft is not opened, and the token is in no part of the answer
      expect(response.headers()['set-cookie'], theme.id).toBeUndefined()
      expect(await response.text(), theme.id).not.toContain(token)
    }

    // A grant that reached the draft route all the same (here, exchanged by hand) gets the same answer on every load, and no draft
    const token = await tokenFor(request, { id: 'absent', version: '1.0.0' })
    const exchanged = await request.post(`${MOCK}/api/micelio/preview/exchange`, { headers: { authorization: 'Bearer e2e-api-token' }, data: { token } })
    const { grant } = (await exchanged.json() as { data: { grant: string } }).data
    const draft = await request.get(DRAFT_URL, { headers: { 'accept': 'application/json', 'cookie': `__Host-micelio_preview=${grant}`, 'x-forwarded-for': address() } })
    expect(draft.status()).toBe(409)
    expect(await draft.json()).toMatchObject({ data: { code: 'themeNotInstalled' } })
    expect(await draft.text()).not.toContain('Field Notes')

    expect(await status(request)).toEqual(statusBefore)
  })
})
