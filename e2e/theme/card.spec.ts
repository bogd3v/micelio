import { existsSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { CARD_ADMIN_ORIGIN } from '../servers'
import { themeDisplay } from '../../modules/theme/display-family'
import { discoverThemes, selectTheme, themeRoots } from '../../modules/theme/themes'

// The social card of a draft (bogd3v/micelio#734), drawn by the server for the active theme: one baseline per theme, in the first mode's desktop folder
// (e2e/theme/__screenshots__/<theme>/<mode>/desktop/card.png). The card does not depend on the viewport or on the mode the project shows.
// A theme that declares no font file cannot draw one: the server answers the documented 500 and there is no baseline. A run with no baselines
// (`THEME_SKIP_VISUAL=1`, admission with `visual: false`) does not load this spec (playwright.theme.config.ts).
// `THEME_CARD_BASELINE=optional`, which only the compat run of a core release sets (theme-compat.yml), lets a published theme version that
// has no `card.png` pass, since it was built before the card existed; the status, the type and the size are still checked, and a baseline that exists is compared
const MOCK_PORT = Number(process.env.THEME_MOCK_PORT ?? 4311)
const DRAFT_PAGE = 'api%3A%3Apage.page/doc-page-draft'

test('social card', async ({ request }, testInfo) => {
  const { theme, mode, viewport } = testInfo.project.metadata as { theme: string, mode: string, viewport: string }
  const { manifest } = selectTheme(discoverThemes(themeRoots(process.cwd())), theme)
  test.skip(mode !== manifest.modes[0]!.id || viewport !== 'desktop', 'one card per theme')
  const hasFont = Boolean(themeDisplay(manifest).file ?? manifest.fonts?.[0])

  const issued = await request.post(`http://127.0.0.1:${MOCK_PORT}/__mock/preview-token`, { data: { kind: 'page', documentId: 'doc-page-draft', locale: 'en', adminOrigin: CARD_ADMIN_ORIGIN } })
  const { token } = await issued.json() as { token: string }
  const opened = await request.get(`/_preview?token=${token}`, { maxRedirects: 0 })
  expect(opened.status()).toBe(303)
  // The cookie is `Secure` and the site is on http here: send it as a header, as the admin's browser would over https
  const cookie = opened.headersArray().find(header => header.name.toLowerCase() === 'set-cookie' && header.value.startsWith('__Host-micelio_preview='))!.value.split(';')[0]!

  const card = await request.get(`/api/preview/${DRAFT_PAGE}/card`, { headers: { cookie } })
  if (!hasFont) {
    expect(card.status()).toBe(500)
    expect((await card.json() as { code: string }).code).toBe('internalError')
    return
  }
  expect(card.status()).toBe(200)
  expect(card.headers()['content-type']).toBe('image/png')
  expect(card.headers()['cache-control']).toBe('private, no-store')
  const bytes = await card.body()
  expect([bytes.readUInt32BE(16), bytes.readUInt32BE(20)]).toEqual([1200, 630])
  if (process.env.THEME_CARD_BASELINE !== 'optional' || existsSync(testInfo.snapshotPath('card.png'))) expect(bytes).toMatchSnapshot('card.png')

  // Without the grant there is no card
  const refused = await request.get(`/api/preview/${DRAFT_PAGE}/card`)
  expect(refused.status()).toBe(404)
})
