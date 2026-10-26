import { brotliDecompressSync, gunzipSync } from 'node:zlib'
import type { H3Event } from 'h3'
import { PAGE_SLUG_PATTERN } from '~/constants/pages'
import { PREVIEW_DRAFT_CONTEXT_KEY } from '~/constants/preview'
import { localizedPath } from '~/helpers/locale'
import { previewDraftPath } from '~/helpers/preview'
import { declaredAssets, measurePage, weightReport } from '~/helpers/weight'
import type { PageBytes, SentFile } from '~/helpers/weight'
import type { Locale, PreviewMode, WeightReport } from '~/interfaces'
import { ARTICLE_POPULATE, PAGE_POPULATE } from '../lib/constants'
import type { PreviewActor, PreviewDraftContext } from '../lib/types'

/** How long a report is kept, per document version (ADR 0019 and bogd3v/micelio#730). */
const REPORT_CACHE_MS = 5 * 60 * 1000
/** The most reports kept at once; the oldest goes first. */
const REPORT_CACHE_MAX = 50
/** Renders in flight at once for one report: each is a server-side render of the draft. */
const RENDER_CONCURRENCY = 4
/** The longest an image from the CMS or the media origin may take. */
const IMAGE_TIMEOUT_MS = 8000

/** The first segments of the fixed routes of the app, which a page of the same slug cannot take over. */
const APP_ROUTE_SLUGS = new Set(['about', 'privacy', 'blog', 'confirm', 'account', 'drafts', 'newsletter'])

/** What the weight route needs to know about a draft: the zone its blocks are in and their catalogue ids, and where the document is published. */
interface DraftZone {
  updatedAt: string
  blocks: string[]
  /** The public path of the document in its locale; `null` when the draft has no slug. */
  publicPath: string | null
}

const reports = new Map<string, { expires: number, report: Promise<WeightReport> }>()

function componentId(component: unknown): string {
  return typeof component === 'string' ? component.split('.').pop() || 'unknown' : 'unknown'
}

/** The draft as the CMS sanitized it, with who the grant that read it acts for. */
interface RedeemedDraft {
  actor: PreviewActor
  draft: PreviewDraftContext['draft']
}

/**
 * Redeems the preview grant of a weight request with the CMS, once, and returns the draft it names.
 *
 * @param grant - A grant of either actor (ADR 0019, amendment of 2026-10-25): the editor's from the cookie, or the CMS's own from `X-Micelio-Preview-Grant`.
 *
 * @throws The draft 404 when the CMS refuses the grant, the draft is missing or the answer does not say who the grant acts for.
 */
export async function redeemDraft(event: H3Event, grant: string, kind: 'article' | 'page', documentId: string): Promise<RedeemedDraft> {
  const { data, actor } = await fetchPreviewDraft<PreviewDraftContext['draft']>(event, grant, documentId, { populate: kind === 'page' ? PAGE_POPULATE : ARTICLE_POPULATE }, { allowSystem: true })
  return { actor, draft: data }
}

/** The draft's `updatedAt` and its blocks' ids. */
async function zoneOf(draft: unknown, kind: 'article' | 'page', locale: Locale): Promise<DraftZone> {
  const { updatedAt, slug, sections, blocks: articleBlocks } = draft as { updatedAt?: unknown, slug?: unknown, sections?: unknown, blocks?: unknown }
  const zone = kind === 'page' ? sections : articleBlocks
  const blocks = Array.isArray(zone) ? zone.map(block => componentId((block as { __component?: unknown } | null)?.__component)) : []
  return { updatedAt: typeof updatedAt === 'string' ? updatedAt : '', blocks, publicPath: await publicPathOf(kind, slug, locale) }
}

/** Where a visitor reads a document once it is published: `/` for the page set as the home page, `/<slug>` for any other page and `/blog/<slug>` for an article. */
async function publicPathOf(kind: 'article' | 'page', slug: unknown, locale: Locale): Promise<string | null> {
  if (typeof slug !== 'string' || !slug) return null
  if (kind === 'article') return localizedPath(`/blog/${encodeURIComponent(slug)}`, locale)
  const { site } = await loadSiteCached(locale)
  if (site.homePage?.slug === slug) return localizedPath('/', locale)
  // A slug that no page route takes, or that a fixed route of the app owns, is never reached at its path
  return PAGE_SLUG_PATTERN.test(slug) && !APP_ROUTE_SLUGS.has(slug) ? localizedPath(`/${slug}`, locale) : null
}

function decode(raw: Buffer, encoding: string | null): string {
  if (encoding === 'br') return brotliDecompressSync(raw).toString('utf8')
  if (encoding === 'gzip') return gunzipSync(raw).toString('utf8')
  return raw.toString('utf8')
}

/** The answer of this server to a request made in process, as the wire carries it: `Accept-Encoding: br, gzip` like `npm run perf`. */
async function localResponse(event: H3Event | null, path: string, headers: Record<string, string>): Promise<{ status: number, raw: Buffer, encoding: string | null }> {
  let encoding = null as string | null
  let status = 200
  // `event.$fetch` forwards the caller's headers (its cookies and `x-forwarded-for`); the global `$fetch` calls the same server in process and forwards none
  const call = event ? event.$fetch : $fetch
  const body = await call<ArrayBuffer>(path, {
    headers: { 'accept-encoding': 'br, gzip', ...headers },
    responseType: 'arrayBuffer',
    ignoreResponseError: true,
    onResponse({ response }) {
      encoding = response.headers.get('content-encoding')
      status = response.status
    },
  })
  return { status, raw: Buffer.from(body), encoding }
}

function sentFile(path: string, { raw, encoding }: { raw: Buffer, encoding: string | null }): SentFile {
  return { sent: raw.length, text: /\.(?:wasm|woff2?|png|jpe?g|webp|avif|gif|svg)(?:\?|$)/.test(path) ? '' : decode(raw, encoding) }
}

async function localFile(event: H3Event | null, path: string, headers: Record<string, string>, isDraft: boolean): Promise<SentFile> {
  const response = await localResponse(event, path, headers)
  // The draft route answers 404 when the request carries no draft of this report
  if (response.status === 404 && isDraft) throw draftNotFound()
  if (response.status !== 200) throw new Error(`${isDraft ? 'The draft' : 'A declared asset'} answered ${response.status} to the measurement`)
  return sentFile(path, response)
}

/**
 * The public page of a document as an anonymous visitor gets it; `null` when it is not published there.
 *
 * @remarks
 * Exported for tests. The request carries no cookie, grant, session or forwarded client header: only `accept` and `accept-encoding`.
 *
 * @internal
 */
export async function publishedPage(path: string): Promise<SentFile | null> {
  const response = await localResponse(null, path, { accept: 'text/html' })
  if (response.status === 404) return null
  if (response.status !== 200) throw new Error(`The published page answered ${response.status} to the measurement`)
  return sentFile(path, response)
}

/** An image of the CMS or the media origin, whose bytes the browser would download; `null` when it answers anything but a 200. */
async function remoteImage(url: string): Promise<SentFile | null> {
  // A redirect would leave the origins this server was configured to call
  const response = await fetch(url, { headers: { 'accept-encoding': 'identity' }, redirect: 'manual', signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS) })
  if (!response.ok) return null
  const declared = Number(response.headers.get('content-length'))
  if (Number.isFinite(declared) && declared > 0) {
    await response.body?.cancel()
    return { sent: declared, text: '' }
  }
  return { sent: (await response.arrayBuffer()).byteLength, text: '' }
}

/** The origins of the URLs that are set and parse; an unset or malformed one names none. */
function originsOf(...urls: unknown[]): string[] {
  return urls.flatMap((url) => {
    try {
      return typeof url === 'string' && url ? [new URL(url).origin] : []
    } catch {
      // A setting that is not a URL names no origin; the server config check reports it at boot
      return []
    }
  })
}

/** Fetches what a rendered page declares, once per URL for the whole report: the hashed assets are the same in every render. */
function fileFetcher(event: H3Event) {
  const config = useRuntimeConfig(event)
  const own = new Set([getRequestURL(event).origin, ...originsOf(config.public.siteUrl)])
  const remote = new Set(originsOf(config.public.strapiUrl, config.mediaUrl))
  const files = new Map<string, Promise<SentFile | null>>()
  return (url: string): Promise<SentFile | null> => {
    const cached = files.get(url)
    if (cached) return cached
    const target = new URL(url)
    // Anything else would be a third party, which no page of Micelio loads; the server does not call it for a draft's content
    const file = own.has(target.origin)
      ? localFile(event, `${target.pathname}${target.search}`, {}, false)
      : remote.has(target.origin) ? remoteImage(url) : Promise.resolve(null)
    files.set(url, file)
    return file
  }
}

/** Runs `work` for the numbers `0..count - 1`, `limit` at a time, and collects the results in order. */
async function mapLimit<R>(count: number, limit: number, work: (index: number) => Promise<R>): Promise<R[]> {
  const results: R[] = Array.from({ length: count })
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, count) }, async () => {
    while (next < count) {
      const index = next++
      results[index] = await work(index)
    }
  }))
  return results
}

async function computeReport(event: H3Event, kind: 'article' | 'page', documentId: string, locale: Locale, mode: PreviewMode, zone: DraftZone): Promise<WeightReport> {
  const origin = getRequestURL(event).origin
  const fetchFile = fileFetcher(event)
  const render = async (without?: number): Promise<{ html: SentFile, url: string }> => {
    const path = previewDraftPath(kind, documentId, locale, mode, without)
    const html = await localFile(event, path, { accept: 'text/html' }, true)
    return { html, url: new URL(path, origin).href }
  }
  const measure = async (without?: number): Promise<PageBytes> => {
    const { html, url } = await render(without)
    return measurePage(html, url, fetchFile)
  }
  const first = await render()
  const draft = await measurePage(first.html, first.url, fetchFile)
  const without = await mapLimit(zone.blocks.length, RENDER_CONCURRENCY, measure)
  // The draft route has chunks of its own and the home route others, so the page's script is what the published route declares plus whatever the draft adds to it
  const published = mode === 'dynamic' && zone.publicPath ? await publishedPage(zone.publicPath) : null
  const whole = published ? await measurePage(first.html, first.url, fetchFile, declaredAssets(published.text, new URL(zone.publicPath!, origin).href).scripts) : draft
  return weightReport(mode, whole, zone.blocks, without, draft)
}

/** Computes a report and forgets it when it fails, so the callers that share it all get the problem and the next request tries again. */
async function computeAndKeep(key: string, event: H3Event, kind: 'article' | 'page', documentId: string, locale: Locale, mode: PreviewMode, zone: DraftZone): Promise<WeightReport> {
  try {
    return await computeReport(event, kind, documentId, locale, mode, zone)
  } catch (error: unknown) {
    reports.delete(key)
    if (error instanceof Error && 'statusCode' in error) throw error
    logError('preview.weight', 'Measuring the draft failed', { event, error })
    throw problem('upstreamUnavailable', { statusMessage: 'Failed to measure the draft' })
  }
}

/**
 * The weight report of a draft the CMS gave to a preview grant: the draft rendered in `mode` and once more without each of its blocks.
 *
 * @param draft - What `redeemDraft` returned, so the CMS is asked for the draft once per report (a `system` grant is single use).
 *
 * @remarks
 * Kept 5 minutes per document version (`updatedAt`), so saving the draft measures it again. A report in progress is shared by the requests that ask for the same one, and a failed one is not kept. The draft is kept in this request's `event.context` for the length of the report: each render is a request made in process (`event.$fetch`) whose page and draft route read it from there, so neither the grant nor a cookie travels (ADR 0019, amendment of 2026-10-25). The public page is rendered with none of the caller's headers.
 *
 * @throws A 502 when a render or an asset fails.
 */
export async function previewWeightReport(event: H3Event, kind: 'article' | 'page', documentId: string, locale: Locale, mode: PreviewMode, draft: unknown): Promise<WeightReport> {
  const zone = await zoneOf(draft, kind, locale)
  const { updatedAt } = zone
  const key = `${kind}:${documentId}:${locale}:${mode}:${updatedAt}`
  const now = Date.now()
  for (const [id, entry] of reports) {
    if (entry.expires <= now) reports.delete(id)
  }
  const cached = reports.get(key)
  if (cached) return cached.report
  event.context[PREVIEW_DRAFT_CONTEXT_KEY] = { kind, documentId, draft } satisfies PreviewDraftContext
  const report = computeAndKeep(key, event, kind, documentId, locale, mode, zone)
  reports.set(key, { expires: now + REPORT_CACHE_MS, report })
  if (reports.size > REPORT_CACHE_MAX) reports.delete(reports.keys().next().value!)
  return report
}
