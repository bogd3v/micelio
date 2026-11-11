import { expect, test } from '@playwright/test'
import type { APIRequestContext, Frame, Page } from '@playwright/test'
import { runDraftPagePlaygroundIndex } from '../fixtures/drafts.mjs'

// ADR 0019, amendment of 2026-11-06 (bogd3v/micelio#880): the admin asks the frame to run a Playground block with `micelio:run` and the frame answers
// `micelio:runResult`. The setup is the one of preview.spec.ts: the admin page on https://localhost, the frontend on https://127.0.0.1, the production build.
// The blocks are JavaScript (QuickJS in the Worker of the reader's Run button): the draft page's fixture prints a sum with its hidden setup, the English
// article draft has one block that prints, one that throws, a loop QuickJS interrupts and a SQL loop that only the Worker's timeout ends (`runDraftPage` and
// `runDraftArticle` of e2e/fixtures/drafts.mjs, which only the preview mock serves).
const APP_PORT = Number(process.env.PREVIEW_APP_PORT ?? 3236)
const MOCK_PORT = Number(process.env.PREVIEW_MOCK_PORT ?? 4336)
const ADMIN_PORT = Number(process.env.PREVIEW_ADMIN_PORT ?? 4436)
const APP = `https://127.0.0.1:${APP_PORT}`
const ADMIN = `https://localhost:${ADMIN_PORT}`
const STRANGER = `https://127.0.0.1:${ADMIN_PORT}`
const PAGE_VERSION = '2026-11-06T11:00:00.000Z'
const ARTICLE_VERSION = '2026-11-06T10:00:00.000Z'
// The runtime loads from /_islands/runtimes/ on the first run
const RUN_WAIT = 45_000

// WebKit refuses the grant cookie in a frame of another site (ADR 0019, section 7); preview.spec.ts pins that and the fallback
const SENDS_PARTITIONED_COOKIE: Record<string, boolean> = { chromium: true, firefox: true, webkit: false }

interface Address { zone: string, index: number, block: string, version: string }
interface Result { requestId: string, address: Address, ok: boolean, output?: string, truncated?: boolean, reason?: string }
type Received = { origin: string, fromFrame: boolean, data: { v: number, type: string, payload: Result } }

const pageAt = (index = runDraftPagePlaygroundIndex): Address => ({ zone: 'sections', index, block: 'playground', version: PAGE_VERSION })
const articleAt = (index: number): Address => ({ zone: 'blocks', index, block: 'playground', version: ARTICLE_VERSION })

const sent = (page: Page, data: unknown): Promise<void> => page.evaluate(([message, origin]) => (window as unknown as { send: (data: unknown, origin: string) => void }).send(message, origin), [data, APP] as const)
const run = (page: Page, requestId: string, address: Address, extra: object = {}): Promise<void> => sent(page, { v: 1, type: 'micelio:run', payload: { requestId, address, ...extra } })
const received = (page: Page): Promise<Received[]> => page.evaluate(() => (window as unknown as { received: Received[] }).received)
const results = async (page: Page): Promise<Result[]> => (await received(page)).filter(message => message.data.type === 'micelio:runResult').map(message => message.data.payload)
const settled = (frame: Frame): Promise<void> => frame.evaluate(() => new Promise<void>(resolve => requestAnimationFrame(() => setTimeout(resolve, 0))))

async function resultOf(page: Page, requestId: string, timeout = RUN_WAIT): Promise<Result> {
  await expect.poll(async () => (await results(page)).some(result => result.requestId === requestId), { timeout }).toBe(true)
  return (await results(page)).find(result => result.requestId === requestId)!
}

async function openDraft(page: Page, request: APIRequestContext, binding: { kind?: 'page', documentId: string, locale: string }): Promise<Frame> {
  // Every exchange with `/_preview` counts against `previewPerIp`: this suite comes from an address of its own
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': `2001:db8:880:${test.info().parallelIndex}:1::1` })
  const response = await request.post(`http://127.0.0.1:${MOCK_PORT}/__mock/preview-token`, { data: { ...binding, adminOrigin: ADMIN } })
  const { token } = await response.json() as { token: string }
  await page.goto(`${ADMIN}/admin.html?src=${encodeURIComponent(`${APP}/_preview?token=${token}`)}`)
  const frame = page.frames().find(candidate => candidate !== page.mainFrame())!
  await expect(frame.getByRole('heading', { level: 1 }).first()).toBeVisible()
  await expect.poll(async () => (await received(page)).some(message => message.data.type === 'ready')).toBe(true)
  return frame
}

test.describe('micelio:run', () => {
  test.skip(({ browserName }) => !SENDS_PARTITIONED_COOKIE[browserName], 'This engine refuses the grant cookie in a frame of another site: preview.spec.ts pins it')

  test('micelio:run answers the output of the saved playground block of a page draft', async ({ page, request }) => {
    const frame = await openDraft(page, request, { kind: 'page', documentId: 'doc-page-run', locale: 'en' })
    const address = pageAt()
    await run(page, 'page-1', address)
    // The saved code and its hidden setup run, and the answer goes back to the admin's origin with the request's id and address
    const answer = await resultOf(page, 'page-1')
    expect(answer).toEqual({ requestId: 'page-1', address, ok: true, output: '42', truncated: false })
    const message = (await received(page)).find(entry => entry.data.type === 'micelio:runResult')!
    expect(message.origin).toBe(APP)
    expect(message.fromFrame).toBe(true)
    // The frame writes nothing into the page: the block is not rendered and the page has no output
    await expect(frame.locator('micelio-playground')).toHaveCount(0)
    await expect(frame.locator('body')).not.toContainText('42')
    // The next run of the same runtime goes through the Worker that is loaded
    await run(page, 'page-2', address)
    expect(await resultOf(page, 'page-2')).toMatchObject({ ok: true, output: '42' })
  })

  test('micelio:run answers the output of a playground block of an article draft', async ({ page, request }) => {
    await openDraft(page, request, { documentId: 'doc-run', locale: 'en' })
    // The article has no marked zone: the block is found in the draft's data, by its position among `blocks`
    await run(page, 'article-1', articleAt(1))
    expect(await resultOf(page, 'article-1')).toEqual({ requestId: 'article-1', address: articleAt(1), ok: true, output: 'article 42', truncated: false })
  })

  test('micelio:run runs the saved code, never code sent in the message', async ({ page, request }) => {
    await openDraft(page, request, { documentId: 'doc-run', locale: 'en' })
    await run(page, 'sent-1', articleAt(1), { code: 'console.log(\'from the message\')', runtime: 'javascript', setup: 'throw new Error(\'from the message\')', output: 'forged' })
    expect(await resultOf(page, 'sent-1')).toMatchObject({ ok: true, output: 'article 42' })
    // A block that is not a playground names no code to run, whatever the message carries
    await run(page, 'sent-2', { ...articleAt(0), block: 'rich-text' }, { code: 'console.log(1)', runtime: 'javascript' })
    expect(await resultOf(page, 'sent-2')).toMatchObject({ ok: false, reason: 'notRunnable' })
  })

  test('micelio:run answers codeError with the reader\'s message and timeout after 5 seconds', async ({ page, request }) => {
    test.setTimeout(150_000)
    await openDraft(page, request, { documentId: 'doc-run', locale: 'en' })
    await run(page, 'error-1', articleAt(2))
    const failed = await resultOf(page, 'error-1')
    expect(failed).toMatchObject({ requestId: 'error-1', address: articleAt(2), ok: false, reason: 'codeError' })
    expect(failed.output).toContain('the saved code fails')
    // No stack, path or URL of the frame goes out with the message
    expect(failed.output).not.toMatch(/https?:|\/_islands\/|\.js:\d/)

    // QuickJS interrupts its own loop after 4 seconds, with the message the reader sees
    await run(page, 'loop-1', articleAt(3))
    const interrupted = await resultOf(page, 'loop-1', 30_000)
    expect(interrupted).toMatchObject({ requestId: 'loop-1', ok: false, reason: 'codeError' })
    expect(interrupted.output).toContain('Interrupted')

    // A SQL loop is ended by the Worker's own limit: 5 seconds after the runtime has loaded
    await run(page, 'loop-2', articleAt(4))
    const timedOut = await resultOf(page, 'loop-2', 60_000)
    expect(timedOut).toEqual({ requestId: 'loop-2', address: articleAt(4), ok: false, reason: 'timeout' })
    // Each Worker was ended or replaced after its run: the next run of the JavaScript runtime works
    await run(page, 'after-loop', articleAt(1))
    expect(await resultOf(page, 'after-loop')).toMatchObject({ ok: true, output: 'article 42' })
  })

  test('micelio:run answers notRunnable for an address with no playground block', async ({ page, request }) => {
    await openDraft(page, request, { kind: 'page', documentId: 'doc-page-run', locale: 'en' })
    const cases: Array<[string, Address]> = [
      ['rich-text', { ...pageAt(0), block: 'rich-text' }],
      ['playground-named-hero', { ...pageAt(0), block: 'playground' }],
      ['past-the-end', pageAt(99)],
      ['other-zone', { ...pageAt(), zone: 'blocks' }],
    ]
    for (const [id, address] of cases) {
      await run(page, id, address)
      expect(await resultOf(page, id, 10_000)).toEqual({ requestId: id, address, ok: false, reason: 'notRunnable' })
    }
  })

  test('drops a micelio:run from another origin or of a stale version, with no answer', async ({ page, request }) => {
    const frame = await openDraft(page, request, { documentId: 'doc-run', locale: 'en' })
    const address = articleAt(1)
    const sibling = (origin: string, message: unknown): string => `${origin}/sibling.html?target=${encodeURIComponent(APP)}&message=${encodeURIComponent(JSON.stringify(message))}`
    const valid = { v: 1, type: 'micelio:run', payload: { requestId: 'dropped', address } }
    const addSibling = (src: string): Promise<void> => page.evaluate(url => (window as unknown as { addSibling: (src: string) => Promise<void> }).addSibling(url), src)
    // Another window of the admin's origin, and another origin altogether
    await addSibling(sibling(ADMIN, valid))
    await addSibling(sibling(STRANGER, valid))
    // The admin's window with a stale version, no id, another version of the envelope and a malformed address
    await run(page, 'stale', { ...address, version: 'an older save' })
    await sent(page, { v: 1, type: 'micelio:run', payload: { address } })
    await sent(page, { v: 2, type: 'micelio:run', payload: { requestId: 'v2', address } })
    await run(page, 'bad-zone', { ...address, zone: 'footer' })
    await settled(frame)
    // The right message still works, so the drops above were not a broken listener
    await run(page, 'valid', address)
    expect(await resultOf(page, 'valid')).toMatchObject({ ok: true, output: 'article 42' })
    expect((await results(page)).map(result => result.requestId)).toEqual(['valid'])
  })
})
