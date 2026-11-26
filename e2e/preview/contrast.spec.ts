import { expect, test } from '@playwright/test'
import type { APIRequestContext, APIResponse } from '@playwright/test'
import { join } from 'node:path'
import { contrastPairs } from '../../app/helpers/contrast'
import type { ContrastReportResponse } from '../../app/interfaces/theme'
import { colorsOf, contrastProblems, contrastRulesFor, lookupFor } from '../../modules/theme/contrast'
import { discoverThemes } from '../../modules/theme/themes'
import type { ThemeManifest } from '../../modules/theme/types'

// `GET /_micelio/contrast` (bogd3v/micelio#737): the contrast matrix of the active theme with candidate accents, for the Customize page of the admin, which must
// give the AA result `theme:check` gives. The expected matrix is computed here by the code of `theme:check` (modules/theme/contrast.ts) on bogota's own
// theme.json, the theme the build pulls (`npm run theme:pull -- --frozen`). Needs the production build, as the rest of e2e/preview.
const APP_PORT = Number(process.env.PREVIEW_APP_PORT ?? 3236)
const MOCK_PORT = Number(process.env.PREVIEW_MOCK_PORT ?? 4336)
const ADMIN_PORT = Number(process.env.PREVIEW_ADMIN_PORT ?? 4436)
const OFF_PORT = Number(process.env.PREVIEW_OFF_PORT ?? 3237)
const APP = `https://127.0.0.1:${APP_PORT}`
const MOCK = `http://127.0.0.1:${MOCK_PORT}`
const ADMIN = `https://localhost:${ADMIN_PORT}`
const SEEDED_PAGE = { kind: 'page', documentId: 'doc-page-draft', locale: 'en' } as const
const FAMILY = { 'accent': 'accent', 'accent-soft': 'accentSoft', 'accent-hover': 'accentHover', 'on-accent': 'onAccent' } as const

const [bogota] = discoverThemes([join(process.cwd(), '.micelio/themes')]).filter(theme => theme.id === 'bogota')

let calls = 0
function address(): string {
  return `2001:db8:737:c${test.info().parallelIndex}:${++calls}::1`
}

/** An editor's grant for the seeded page draft, exchanged by hand as `/_preview` would. */
async function adminGrant(request: APIRequestContext): Promise<string> {
  const token = (await (await request.post(`${MOCK}/__mock/preview-token`, { data: { ...SEEDED_PAGE, adminOrigin: ADMIN } })).json() as { token: string }).token
  const exchanged = await request.post(`${MOCK}/api/micelio/preview/exchange`, { headers: { authorization: 'Bearer e2e-api-token' }, data: { token } })
  return (await exchanged.json() as { data: { grant: string } }).data.grant
}

function contrast(request: APIRequestContext, grant: string | null, query: string, origin = APP): Promise<APIResponse> {
  return request.get(`${origin}/_micelio/contrast?documentId=${SEEDED_PAGE.documentId}${query}`, {
    headers: { 'x-forwarded-for': address(), 'origin': ADMIN, ...(grant && { cookie: `__Host-micelio_preview=${grant}` }) },
  })
}

/** bogota with the accent family of each mode replaced by the one the endpoint answered: what `theme:check` measures for those values. */
function withAccents(manifest: ThemeManifest, accents: Record<string, Record<string, string> | null>): ThemeManifest {
  const modes = manifest.modes.map(mode => mode.id)
  const tokens = manifest.color.tokens.map((token) => {
    const key = FAMILY[token.name as keyof typeof FAMILY]
    if (!key || !modes.some(mode => accents[mode])) return token
    const own = (mode: string): string => (typeof token.value === 'object' ? token.value[mode]! : token.value)
    return { ...token, value: Object.fromEntries(modes.map(mode => [mode, accents[mode]?.[key] ?? own(mode)])) }
  })
  return { ...manifest, color: { ...manifest.color, tokens } }
}

/** The pairs of every mode as `theme:check` computes them, in the shape of the endpoint's answer. */
function expectedPairs(manifest: ThemeManifest): Record<string, Array<{ role: string, surface: string, ratio: number | null, min: number, passes: boolean }>> {
  const rules = contrastRulesFor(manifest)
  return Object.fromEntries(manifest.modes.map(mode => [mode.id, contrastPairs(rules, colorsOf(lookupFor(manifest, mode.id))).map(({ role, surface, ratio, min, passes }) => ({ role, surface, ratio, min, passes }))]))
}

test.describe('the contrast matrix for the Customize page', () => {
  test('answers for the active theme and a candidate accent the pairs, ratios and results of theme:check', async ({ request }) => {
    expect(bogota, 'bogota is pulled into .micelio/themes').toBeDefined()
    const manifest = bogota!.manifest
    const grant = await adminGrant(request)

    // No candidate: the theme as `theme:check` sees it, which passes every pair
    const own = await contrast(request, grant, '')
    expect(own.status()).toBe(200)
    expect(own.headers()['cache-control']).toBe('private, no-store')
    expect(own.headers()['access-control-allow-origin']).toBe(ADMIN)
    const plain = (await own.json() as ContrastReportResponse).data
    expect(plain.theme).toBe('bogota')
    expect(plain.modes.map(mode => mode.mode)).toEqual(['noche', 'dia'])
    const expected = expectedPairs(manifest)
    for (const mode of plain.modes) {
      expect(mode.accent).toBeNull()
      expect(mode.pairs).toEqual(expected[mode.mode])
      expect(mode.pairs.length).toBeGreaterThan(40)
    }
    expect(contrastProblems(manifest)).toEqual([])

    // Candidates: one bogota keeps as it is in noche, one too dark for noche's surfaces in dia's place, and a mode it lacks
    const answer = await contrast(request, grant, `&accent=${encodeURIComponent('noche:#5eead4')}&accent=${encodeURIComponent('dia:#ffb347')}&accent=${encodeURIComponent('sepia:#123456')}`)
    expect(answer.status()).toBe(200)
    const candidate = (await answer.json() as ContrastReportResponse).data
    const accents = Object.fromEntries(candidate.modes.map(mode => [mode.mode, mode.accent as Record<string, string> | null]))
    expect(accents.noche?.accent).toBe('#5eead4')
    // dia moves the candidate until it passes, as a saved override (ADR 0005, section 8)
    expect(accents.dia?.accent).toMatch(/^#[\da-f]{6}$/)
    expect(accents.dia?.accent).not.toBe('#ffb347')
    expect(candidate.modes.map(mode => mode.mode)).toEqual(['noche', 'dia'])
    const applied = withAccents(manifest, accents)
    const measured = expectedPairs(applied)
    for (const mode of candidate.modes) expect(mode.pairs, mode.mode).toEqual(measured[mode.mode])
    // The failures are those `theme:check` reports for that theme: the resolved family passes every pair it moves
    const failures = candidate.modes.flatMap(mode => mode.pairs.filter(pair => !pair.passes).map(({ role, surface, ratio, min }) => ({ mode: mode.mode, role, surface, ratio, min })))
    expect(failures).toEqual(contrastProblems(applied).map(({ mode, role, surface, ratio, min }) => ({ mode, role, surface, ratio, min })))
    expect(failures).toEqual([])
    // The ratios moved with the accent
    const ratioOf = (pairs: typeof plain.modes[number]['pairs']): number | null | undefined => pairs.find(pair => pair.role === 'accent' && pair.surface === 'surface')?.ratio
    expect(ratioOf(candidate.modes[0]!.pairs)).not.toBe(ratioOf(plain.modes[0]!.pairs))
  })

  test('answers the same 404 without an admin grant, with a system grant and with the preview off', async ({ request }) => {
    const grant = await adminGrant(request)
    const system = (await (await request.post(`${MOCK}/__mock/preview-system-grant`, { data: SEEDED_PAGE })).json() as { grant: string }).grant
    const refusals = {
      'no grant': await contrast(request, null, ''),
      'an unknown grant': await contrast(request, `preview-grant-0-${'y'.repeat(24)}`, ''),
      'a system grant': await contrast(request, system, ''),
      'another document': await request.get(`${APP}/_micelio/contrast?documentId=doc-linux`, { headers: { 'x-forwarded-for': address(), 'cookie': `__Host-micelio_preview=${grant}` } }),
      'a candidate outside the grammar': await contrast(request, grant, `&accent=${encodeURIComponent('noche:red')}`),
      'the preview off': await contrast(request, grant, '', `http://127.0.0.1:${OFF_PORT}`),
    }
    const bodies = new Set<string>()
    for (const [name, response] of Object.entries(refusals)) {
      expect(response.status(), name).toBe(404)
      expect(response.headers()['cache-control'], name).toBe('private, no-store')
      expect(response.headers()['content-type'], name).toContain('application/problem+json')
      const text = await response.text()
      expect(JSON.parse(text), name).toMatchObject({ status: 404, code: 'notFound' })
      for (const secret of [grant, system]) expect(text, name).not.toContain(secret)
      bodies.add(text)
    }
    // One answer for every refusal: nothing in it tells them apart
    expect([...bodies]).toHaveLength(1)
    // The grant still works on the same server: the refusals above are not an exhausted grant
    expect((await contrast(request, grant, '')).status()).toBe(200)
  })

  test('answers 429 with Retry-After after 60 requests a minute from one visitor', async ({ request }) => {
    const grant = await adminGrant(request)
    // An address of its own, with a /64 no other test, engine or retry uses: the limit counts an IPv6 address by its /64
    const { project, retry, repeatEachIndex } = test.info()
    const visitor = `2001:db8:737:f${['chromium', 'firefox', 'webkit'].indexOf(project.name) + 1}${retry}${repeatEachIndex}::1`
    const ask = (): Promise<APIResponse> => request.get(`${APP}/_micelio/contrast?documentId=${SEEDED_PAGE.documentId}`, { headers: { 'x-forwarded-for': visitor, 'cookie': `__Host-micelio_preview=${grant}` } })
    const statuses = await Promise.all(Array.from({ length: 60 }, async () => (await ask()).status()))
    expect(statuses.every(status => status === 200)).toBe(true)
    const limited = await ask()
    expect(limited.status()).toBe(429)
    expect(Number(limited.headers()['retry-after'])).toBeGreaterThan(0)
    expect(limited.headers()['content-type']).toContain('application/problem+json')
    expect(await limited.json()).toMatchObject({ status: 429, code: 'tooManyRequests' })
  })
})
