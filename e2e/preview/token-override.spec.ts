import { expect, test } from '@playwright/test'
import type { APIRequestContext, Page, Response } from '@playwright/test'

// The accent overrides of a preview token (ADR 0019, amendment of 2026-11-25, bogd3v/micelio#737). The mock CMS binds them to the token and answers them on
// the exchange and on every draft read of its grant, as micelio-plugin-core does (bogd3v/micelio-plugin-core#268). The site's theme is bogota (modes noche
// and dia), and the mock's site settings carry no accent override, so a draft without one has no `#theme-overrides`. The draft is opened as a page of the
// site, as theme-override.spec.ts does. Needs the production build (`npm run theme:pull -- --frozen`, then `npm run build`): the CSP is only sent there.
const APP_PORT = Number(process.env.PREVIEW_APP_PORT ?? 3236)
const MOCK_PORT = Number(process.env.PREVIEW_MOCK_PORT ?? 4336)
const ADMIN_PORT = Number(process.env.PREVIEW_ADMIN_PORT ?? 4436)
const APP = `https://127.0.0.1:${APP_PORT}`
const MOCK = `http://127.0.0.1:${MOCK_PORT}`
const ADMIN = `https://localhost:${ADMIN_PORT}`
const SEEDED_PAGE = { kind: 'page', documentId: 'doc-page-draft', locale: 'en' } as const
const DRAFT_URL = `${APP}/drafts/pages/doc-page-draft?locale=en`
const OVERRIDES = /<style id="theme-overrides">([^<]*)<\/style>/
// Accents bogota keeps as they are in each mode: no contrast adjustment moves them
const NOCHE = '#5eead4'
const DIA = '#0b5cad'

interface Bound { accentOverrides?: Array<{ mode: string, color: string }>, overrides?: Record<string, unknown> }

// Every exchange with `/_preview` counts against `previewPerIp` (30 a minute, `server/utils/rateLimit.ts`), and an IPv6 address counts by its /64 (`ipBucket`,
// `server/lib/clientIp.ts`): each draft a worker opens comes from a /64 of its own, the fourth group made of the worker and a counter (it wraps after 256 drafts)
let opened = 0
function address(): string {
  return `2001:db8:737:${(test.info().parallelIndex * 0x100 + (++opened % 0x100)).toString(16)}::1`
}

async function tokenFor(request: APIRequestContext, bound: Bound = {}): Promise<string> {
  const response = await request.post(`${MOCK}/__mock/preview-token`, { data: { ...SEEDED_PAGE, adminOrigin: ADMIN, ...bound } })
  return (await response.json() as { token: string }).token
}

/** Opens `/_preview` for a fresh token as a page of the site and returns the draft's response, once the page has settled on it. */
async function openDraft(page: Page, request: APIRequestContext, bound?: Bound): Promise<Response> {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': address() })
  // Leave the draft first and start with no grant, as theme-override.spec.ts does: a redirect to the same address, or the grant of the previous preview, would pass the wait below
  await page.goto('about:blank')
  await page.context().clearCookies({ name: '__Host-micelio_preview' })
  const token = await tokenFor(request, bound)
  const answered = page.waitForResponse(response => response.url() === DRAFT_URL)
  await page.goto(`${APP}/_preview?token=${token}`)
  await page.waitForURL(DRAFT_URL)
  await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
  return answered
}

/** The rules of `#theme-overrides` in the draft's HTML as sent, or `null` when there is none. */
async function overridesOf(response: Response): Promise<string | null> {
  return OVERRIDES.exec(await response.text())?.[1] ?? null
}

/** The computed value of a role on the page in one mode. */
function roleIn(page: Page, mode: string, role: string): Promise<string> {
  return page.evaluate(([mode, role]) => {
    document.documentElement.dataset.theme = mode
    return getComputedStyle(document.documentElement).getPropertyValue(`--${role}`).trim()
  }, [mode, role] as const)
}

test.describe('accent overrides bound to the preview token', () => {
  test('renders an accent override bound to the grant as the accent of the draft', async ({ page, request }) => {
    const plain = await openDraft(page, request)
    expect(await overridesOf(plain)).toBeNull()
    const own = { noche: await roleIn(page, 'noche', 'accent'), dia: await roleIn(page, 'dia', 'accent') }
    expect(own.noche).not.toBe(NOCHE)
    expect(own.dia).not.toBe(DIA)

    const draft = await openDraft(page, request, { accentOverrides: [{ mode: 'noche', color: NOCHE }, { mode: 'dia', color: DIA.toUpperCase() }] })
    expect(draft.status()).toBe(200)
    expect(draft.headers()['cache-control']).toContain('no-store')
    const rules = await overridesOf(draft)
    expect(rules).toContain(`[data-theme="noche"]{--accent:${NOCHE};`)
    expect(rules).toContain(`[data-theme="dia"]{--accent:${DIA};`)
    expect(await roleIn(page, 'noche', 'accent')).toBe(NOCHE)
    expect(await roleIn(page, 'dia', 'accent')).toBe(DIA)

    // Every load reads the overrides from the CMS again: a reload keeps them, and no cookie holds them
    await page.reload()
    await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
    expect(await roleIn(page, 'noche', 'accent')).toBe(NOCHE)
    for (const cookie of await page.context().cookies()) expect(`${cookie.name}=${cookie.value}`.toLowerCase()).not.toMatch(/5eead4|0b5cad|accent/)

    // A visitor's page, and the same draft without overrides, keep the theme's accent
    const visitor = await request.get(`${APP}/showcase`, { headers: { 'x-forwarded-for': address() } })
    expect(OVERRIDES.exec(await visitor.text())).toBeNull()
    await openDraft(page, request)
    expect(await roleIn(page, 'noche', 'accent')).toBe(own.noche)
    expect(await roleIn(page, 'dia', 'accent')).toBe(own.dia)
  })

  test('ignores an override of a role other than the accent, and of a mode the theme does not have', async ({ page, request }) => {
    await openDraft(page, request)
    const ink = { noche: await roleIn(page, 'noche', 'ink'), dia: await roleIn(page, 'dia', 'ink') }

    // Only a mode and an accent: the plugin refuses the rest, and the frontend drops it whatever the CMS answers
    const others = await openDraft(page, request, { overrides: { ink: '#ff0000', roles: { ink: '#ff0000' }, inkOverrides: [{ mode: 'noche', color: '#ff0000' }] }, accentOverrides: [{ mode: 'sepia', color: '#123456' }] })
    expect(others.status()).toBe(200)
    expect(await overridesOf(others)).toBeNull()
    expect(await roleIn(page, 'noche', 'ink')).toBe(ink.noche)
    expect(await roleIn(page, 'dia', 'ink')).toBe(ink.dia)

    // Beside an accent the theme has, they still change nothing but that accent
    const mixed = await openDraft(page, request, { overrides: { ink: '#ff0000' }, accentOverrides: [{ mode: 'sepia', color: '#123456' }, { mode: 'noche', color: NOCHE }] })
    expect(await overridesOf(mixed)).toMatch(/^\[data-theme="noche"\]\{--accent:#5eead4;--accent-soft:#[\da-f]{6};--accent-hover:#[\da-f]{6};--on-accent:#[\da-f]{6}\}$/)
    expect(await roleIn(page, 'noche', 'ink')).toBe(ink.noche)
  })

  test('sends a draft with overrides under the same Content-Security-Policy as without them', async ({ page, request }) => {
    const plain = await openDraft(page, request)
    const overridden = await openDraft(page, request, { accentOverrides: [{ mode: 'noche', color: NOCHE }, { mode: 'dia', color: DIA }] })
    expect(await overridesOf(overridden)).not.toBeNull()
    const policy = overridden.headers()['content-security-policy']
    expect(policy).toContain(`frame-ancestors ${ADMIN}`)
    expect(policy).toContain('style-src \'self\' \'unsafe-inline\'')
    expect(policy).toBe(plain.headers()['content-security-policy'])
  })
})
