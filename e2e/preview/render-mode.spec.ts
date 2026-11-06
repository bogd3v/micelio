import { expect, test } from '@playwright/test'
import type { APIRequestContext, Frame, Page } from '@playwright/test'

// ADR 0019, amendment of 2026-11-04 (bogd3v/micelio#837, #735): the admin's island label toggles one block between its dynamic render and its static
// alternative with `micelio:renderMode`. The page of the draft shows the scene, the one heavy island a section renders, as its poster in place. The
// setup is the one of preview.spec.ts: the admin page on https://localhost, the frontend on https://127.0.0.1, the production build.
const APP_PORT = Number(process.env.PREVIEW_APP_PORT ?? 3236)
const MOCK_PORT = Number(process.env.PREVIEW_MOCK_PORT ?? 4336)
const ADMIN_PORT = Number(process.env.PREVIEW_ADMIN_PORT ?? 4436)
const APP = `https://127.0.0.1:${APP_PORT}`
const ADMIN = `https://localhost:${ADMIN_PORT}`

// WebKit refuses the grant cookie in a frame of another site (ADR 0019, section 7); preview.spec.ts pins that and the fallback
const SENDS_PARTITIONED_COOKIE: Record<string, boolean> = { chromium: true, firefox: true, webkit: false }

interface Block { address: { zone: string, index: number, block: string, version: string } }

const sent = (page: Page, type: string, payload: unknown): Promise<void> => page.evaluate(([data, origin]) => (window as unknown as { send: (data: unknown, origin: string) => void }).send(data, origin), [{ v: 1, type, payload }, APP] as const)
const received = (page: Page): Promise<Array<{ data: { type: string, payload: unknown } }>> => page.evaluate(() => (window as unknown as { received: Array<{ data: { type: string, payload: unknown } }> }).received)
const settled = (frame: Frame): Promise<void> => frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))))

async function openPage(page: Page, request: APIRequestContext): Promise<{ frame: Frame, scene: Block['address'] }> {
  // Every exchange with `/_preview` counts against `previewPerIp`: this suite comes from an address of its own
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:735:${test.info().parallelIndex}:1::1` })
  const response = await request.post(`http://127.0.0.1:${MOCK_PORT}/__mock/preview-token`, { data: { kind: 'page', documentId: 'doc-page-draft', locale: 'en', adminOrigin: ADMIN } })
  const { token } = await response.json() as { token: string }
  await page.goto(`${ADMIN}/admin.html?src=${encodeURIComponent(`${APP}/_preview?token=${token}`)}`)
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!
  await expect(frame.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect.poll(async () => (await received(page)).filter(message => message.data.type === 'micelio:blocks').length).toBeGreaterThan(0)
  const report = (await received(page)).filter(message => message.data.type === 'micelio:blocks').at(-1)!.data.payload as { blocks: Block[] }
  return { frame, scene: report.blocks.find(block => block.address.block === 'scene')!.address }
}

test.describe('micelio:renderMode', () => {
  test.skip(({ browserName }) => !SENDS_PARTITIONED_COOKIE[browserName], 'This engine refuses the grant cookie in a frame of another site: preview.spec.ts pins it')

  test('micelio:renderMode shows the block\'s static alternative in place', async ({ page, request }) => {
    const { frame, scene } = await openPage(page, request)
    const block = frame.locator(`[data-myc-zone] > [data-myc-block="scene"][data-myc-index="${scene.index}"]`)
    await frame.evaluate(() => {
      (window as unknown as { probe: string }).probe = 'same document'
    })
    await expect(block.locator('micelio-scene')).toHaveCount(1)
    await expect(block.locator('[data-scene-static]')).toHaveCount(0)

    // The poster stays, as the element's child becomes the child of a plain element: same block, same place, no navigation
    await sent(page, 'micelio:renderMode', { address: scene, mode: 'static' })
    await expect(block.locator('[data-scene-static] img')).toHaveCount(1)
    await expect(block.locator('micelio-scene')).toHaveCount(0)
    expect(await frame.locator('[data-myc-zone] > [data-myc-block]').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-myc-block')).indexOf('scene'))).toBe(scene.index)
    expect(await frame.evaluate(() => (window as unknown as { probe: string }).probe)).toBe('same document')
    // The page has no other scene, so none of the island's element is left
    await expect(frame.locator('micelio-scene')).toHaveCount(0)

    await sent(page, 'micelio:renderMode', { address: scene, mode: 'dynamic' })
    await expect(block.locator('micelio-scene img')).toHaveCount(1)
    await expect(block.locator('[data-scene-static]')).toHaveCount(0)
  })

  test('drops a renderMode of a stale version, an unknown mode or a block that is not there', async ({ page, request }) => {
    const { frame, scene } = await openPage(page, request)
    const block = frame.locator(`[data-myc-zone] > [data-myc-block="scene"][data-myc-index="${scene.index}"]`)
    await sent(page, 'micelio:renderMode', { address: { ...scene, version: 'an older save' }, mode: 'static' })
    await sent(page, 'micelio:renderMode', { address: scene, mode: 'paused' })
    await sent(page, 'micelio:renderMode', { address: { ...scene, index: 99 }, mode: 'static' })
    await sent(page, 'micelio:renderMode', { address: { ...scene, block: 'hero' }, mode: 'static' })
    await settled(frame)
    await expect(block.locator('micelio-scene')).toHaveCount(1)
    await expect(block.locator('[data-scene-static]')).toHaveCount(0)
  })

  test('a reload of the frame shows the block in the mode it has on load', async ({ page, request }) => {
    const { frame, scene } = await openPage(page, request)
    const block = frame.locator(`[data-myc-zone] > [data-myc-block="scene"][data-myc-index="${scene.index}"]`)
    await sent(page, 'micelio:renderMode', { address: scene, mode: 'static' })
    await expect(block.locator('[data-scene-static]')).toHaveCount(1)
    await frame.evaluate(() => window.location.reload())
    const again = page.frames().find(candidate => candidate !== page.mainFrame())!
    await expect(again.locator(`[data-myc-zone] > [data-myc-block="scene"] micelio-scene`)).toHaveCount(1)
    await expect(again.locator('[data-scene-static]')).toHaveCount(0)
  })
})
