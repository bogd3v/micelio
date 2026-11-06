import { redirectTarget, resolveRedirects } from '~/helpers/redirects'
import type { ResolvedRedirects } from '~/helpers/redirects'
import { fetchRedirects } from '../lib/redirects'

interface RedirectsState {
  resolved: ResolvedRedirects
  etag: string | null
  /** When the CMS was last asked, whatever it answered. */
  checkedAt: number
}

// The list in use, which a failed read leaves in place
let state: RedirectsState | undefined
let reading: Promise<void> | undefined

async function read(): Promise<RedirectsState> {
  const config = useRuntimeConfig()
  const previous = state
  const checkedAt = Date.now()
  try {
    const answer = await fetchRedirects({ strapiUrl: config.public.strapiUrl, strapiApiToken: config.strapiApiToken }, String(config.micelioSite ?? ''), previous?.etag ?? null)
    if (answer.status === 'unchanged' && previous) return { ...previous, checkedAt }
    if (answer.status === 'changed') {
      const resolved = resolveRedirects(answer.rows)
      for (const line of resolved.dropped) logWarn('cms.redirects.dropped', `Redirect dropped: ${line}`)
      return { resolved, etag: answer.etag, checkedAt }
    }
    if (answer.status === 'forbidden') {
      // The token lacks the grant: the CMS has to give it (docs/security.md); the last list stays meanwhile
      logError('cms.redirects', 'The API token cannot read the redirects; it needs plugin::micelio.redirects.find')
      return { resolved: previous?.resolved ?? { paths: new Map(), dropped: [] }, etag: previous?.etag ?? null, checkedAt }
    }
    if (answer.status === 'unknownSite') {
      // A wrong NUXT_MICELIO_SITE (or no default site) is a mistake to fix, not a CMS without redirects; the last list stays
      logError('cms.redirects', `The plugin does not know the site "${String(config.micelioSite ?? '')}"; check NUXT_MICELIO_SITE`)
      return { resolved: previous?.resolved ?? { paths: new Map(), dropped: [] }, etag: previous?.etag ?? null, checkedAt }
    }
    // Absent, or a 304 with no list in hand: none to answer
    return { resolved: { paths: new Map(), dropped: [] }, etag: null, checkedAt }
  } catch (error) {
    // The last list stays in use; the next read is after the interval, so a CMS that is down costs one slow request, not every one
    logError('cms.redirects', 'Reading the redirects failed; the last list stays in use', { error })
    return { resolved: previous?.resolved ?? { paths: new Map(), dropped: [] }, etag: previous?.etag ?? null, checkedAt }
  }
}

async function refresh(): Promise<void> {
  try {
    state = await read()
  } finally {
    reading = undefined
  }
}

/**
 * Where `pathname` is redirected to, or `undefined`.
 *
 * @remarks
 * The list comes from the plugin (`GET /api/micelio/redirects`) and is asked again with its `ETag` at most every `siteCacheSeconds`. A failure to read it never rejects: the last list stays in use (none, before the first read).
 */
export async function redirectFor(pathname: string): Promise<string | undefined> {
  const interval = Number(useRuntimeConfig().siteCacheSeconds) * 1000
  if (!state || !(state.checkedAt + interval > Date.now())) {
    reading ??= refresh()
    await reading
  }
  return redirectTarget(state!.resolved.paths, pathname)
}
