import { cpSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import qs from 'qs'
import { defaultLocale } from '../../app/interfaces/locale'
import type { RequestedTheme, ThemeIdentity } from '../../app/interfaces/theme'
import { STATIC_AUDIT_PATH } from '../../app/constants/site'
import { DOWNLOAD_TIMEOUT_MS } from '../../server/lib/themeSwitch/constants'
import { startThemeSwitch } from '../../server/lib/themeSwitch/boot'
import type { StartOptions } from '../../server/lib/themeSwitch/boot'
import type { ThemeSwitch } from '../../server/lib/themeSwitch/types'
import { strapiRequest } from '../../server/lib/strapiRequest'
import type { StrapiRequestConfig } from '../../server/lib/types'
import { THEME_ID } from './constants'
import { BUILT_IN_INDEX, INSTALL_LEASE_MS, STORE_DIR } from './install/constants'
import type { BuiltInIndex } from './install/types'

// The theme of a static or landing build comes from the site settings and the registry, not from the image (ADR 0009, section 7, #315).
// The checks are the ones the server makes when it switches (`server/lib/themeSwitch/`): the grammar of the pin, the tier, the signed index,
// the digest and the attestation of the package, `installTheme()`. This file only asks the switch once and turns its refusal into a failed build.

/** The three fields of the site settings' `theme` component that name a theme (micelio-cms#97), as Strapi stores them. */
export interface NamedTheme {
  themeId?: string
  themeVersion?: string
  themeDigest?: string
}

/** The theme the build renders and publishes, and where it came from. */
export interface StaticTheme {
  /** The theme the pages name: its `digest` is the `<digest>` of `/_t/<digest>/`. */
  identity: ThemeIdentity
  /** `default`: the settings name none, so the build's default theme. `built-in`: a theme of the image, by id or by its locked digest. `installed`: pulled from the registry for this build. */
  source: 'default' | 'built-in' | 'installed'
  /** What the site settings named; `null` when they name none. */
  requested: RequestedTheme | null
}

/** The theme the site settings name could not be resolved; the message says which rule refused it and starts with `Static theme:`. */
export class StaticThemeError extends Error {}

const FIELDS = ['themeId', 'themeVersion', 'themeDigest'] as const

/** More than a download (`DOWNLOAD_TIMEOUT_MS`) and an isolated install (`INSTALL_LEASE_MS`) can take, so a timeout here means the switch is stuck. */
const SETTLE_TIMEOUT_MS = DOWNLOAD_TIMEOUT_MS + INSTALL_LEASE_MS + 10_000

/** The error code of a failed request (`ECONNREFUSED`), never its text, which holds the CMS's address and query. */
function codeOf(error: unknown): string | undefined {
  const { code, cause } = (error ?? {}) as { code?: unknown, cause?: { code?: unknown } }
  const found = typeof code === 'string' ? code : typeof cause?.code === 'string' ? cause.code : undefined
  return found !== undefined && /^[A-Z0-9_]{1,40}$/.test(found) ? found : undefined
}

function statusOf(error: unknown): number | undefined {
  const { response, statusCode } = (error ?? {}) as { response?: { status?: unknown }, statusCode?: unknown }
  const status = response?.status ?? statusCode
  return typeof status === 'number' ? status : undefined
}

/**
 * Reads the theme the site settings name, with the build's read-only token.
 *
 * @remarks
 * The `theme` component is not translated, so the default language is asked, as the server does. A site with no settings yet (404) or no `theme`
 * names nothing. Anything else that goes wrong is an error and never "no theme": a Strapi that is down must not publish the default theme over
 * the one the editor chose. A field that is not a string is an error for the same reason.
 *
 * @throws `StaticThemeError` when the CMS cannot be read or a field has another type.
 */
export async function readNamedTheme(config: StrapiRequestConfig): Promise<NamedTheme> {
  let data: unknown
  try {
    const query = qs.stringify({ populate: { theme: { populate: '*' } }, locale: defaultLocale })
    data = (await strapiRequest<{ data?: unknown }>(config, `/api/site-setting?${query}`, { timeout: 30_000 })).data
  } catch (error) {
    if (statusOf(error) === 404) return {}
    const status = statusOf(error)
    throw new StaticThemeError(`Static theme: the site settings could not be read from Strapi (${status === undefined ? codeOf(error) ?? 'the request failed' : `HTTP ${status}`}), so the theme they name is unknown`, { cause: error })
  }
  // `data: null` is how Strapi says a single type has no entry yet; any other answer that is not an object (a proxy's page) is not the settings
  if (data === null) return {}
  if (typeof data !== 'object' || data === undefined) throw new StaticThemeError('Static theme: Strapi did not answer with the site settings, so the theme they name is unknown')
  const theme = (data as { theme?: unknown }).theme ?? undefined
  if (theme === undefined) return {}
  if (typeof theme !== 'object') throw new StaticThemeError('Static theme: site-setting.theme is not an object')
  const named: NamedTheme = {}
  for (const field of FIELDS) {
    const value = (theme as Record<string, unknown>)[field]
    if (value === undefined || value === null) continue
    if (typeof value !== 'string') throw new StaticThemeError(`Static theme: site-setting.theme.${field} is not a string`)
    named[field] = value
  }
  return named
}

function describe(requested: RequestedTheme | null): string {
  if (requested === null) return 'the default theme'
  if (requested.id === '') return 'a version or a digest with no theme id'
  // The text of an invalid pin is an editor's: only a valid id is echoed, and a version never is
  return THEME_ID.test(requested.id) ? `"${requested.id}"` : 'a theme id that is not valid'
}

/**
 * Asks a theme switch for the theme the site settings name and waits for the answer.
 *
 * @remarks
 * A refusal (an invalid pin, an unknown theme, a tier, a code theme this image lacks, a digest or attestation that does not verify, a version
 * the index yanked or marked incompatible, a registry that is down) leaves the switch on the default theme and records why; here that is a failed build,
 * since publishing another theme than the one the editor chose is the wrong outcome. The text is the switch's own, which holds no URL or path.
 *
 * @throws `StaticThemeError` with the rule and the reason when the switch refused, or did not finish in time.
 */
export async function settleStaticTheme(themeSwitch: ThemeSwitch, named: NamedTheme, timeoutMs = SETTLE_TIMEOUT_MS): Promise<StaticTheme> {
  themeSwitch.observe(named)
  await themeSwitch.settled(timeoutMs)
  const { active, requested, error } = themeSwitch.status()
  if (error) throw new StaticThemeError(`Static theme: the theme the site settings name (${describe(error.requested)}) was not used (${error.rule}): ${error.message}`)
  const reached = requested === null || (active.id === requested.id && (requested.digest === undefined || active.packageDigest === requested.digest))
  if (!reached) throw new StaticThemeError(`Static theme: the theme the site settings name (${describe(requested)}) was not ready after ${Math.round(timeoutMs / 1000)} s`)
  const installed = themeSwitch.active().entry.manifest.origin === 'package'
  return { identity: active, source: installed ? 'installed' : requested === null ? 'default' : 'built-in', requested }
}

/**
 * The index of the built-in store with an installed theme listed under its id, so the prerender's server loads it as it loads any built-in theme.
 *
 * @remarks
 * `pinned` is the package digest the site settings name, which `isPackage` and the status read. A theme that was not installed is already in the index.
 */
export function listInstalledTheme(index: BuiltInIndex, { identity, source }: StaticTheme): BuiltInIndex {
  if (source !== 'installed') return index
  return { ...index, themes: { ...index.themes, [identity.id]: { digest: identity.digest, version: identity.version ?? '', code: false, pinned: identity.packageDigest } } }
}

/**
 * The package digest of the theme the site last published, from `_micelio.json` in `dir`, or `undefined` when there is none (a first build) or it is unreadable.
 *
 * @remarks
 * It only lets a yanked version install again for a site that is live on it (ADR 0009, section 3(a)). The file is an input with the trust of the volume it
 * sits in: whoever can write there can already replace the site, but a file edited to name a yanked version's digest does let that version install. The
 * registry's signed index and the attestation still decide that the package is the one the digest names, and `incompatible` is never let through.
 */
export function readLiveDigest(dir: string | undefined): string | undefined {
  if (!dir) return undefined
  try {
    const { theme } = JSON.parse(readFileSync(join(dir, STATIC_AUDIT_PATH), 'utf8')) as { theme?: { packageDigest?: unknown } }
    return typeof theme?.packageDigest === 'string' && /^sha256:[0-9a-f]{64}$/.test(theme.packageDigest) ? theme.packageDigest : undefined
  } catch {
    return undefined // no site was published here yet, or its audit file is not ours: nothing is live
  }
}

/** What `resolveStaticTheme` needs from the build. */
export interface ResolveStaticThemeOptions extends Pick<StartOptions, 'builtInDir' | 'configured' | 'env' | 'warn' | 'core'> {
  /** Strapi and the build token; without either there is nothing to read and the default theme applies (the static routes fail the build on their own). */
  strapi: StrapiRequestConfig
}

/**
 * Resolves the theme of a static build: reads the site settings, then installs what they name into the built-in store of the build.
 *
 * @remarks
 * `builtInDir` is also the deployment store of this resolution, so an installed theme lands next to the built-in entries, the build's
 * server plugin loads it like any of them once the caller adds it to the index, and the next build starts from an empty store (the folder is made per build).
 * Installing is on unless `MICELIO_THEME_INSTALL` says otherwise, and the registry, its signer and `MICELIO_THEME_TIERS` are the server's variables.
 * The site published last is the one in the folder `env.OUT_DIR` names (the builder image's volume); a yanked version installs again only for the theme that site is live on.
 *
 * @throws `StaticThemeError` when the settings cannot be read or the theme they name is refused; `Error` naming a variable when one is invalid.
 */
export async function resolveStaticTheme(options: ResolveStaticThemeOptions): Promise<StaticTheme> {
  const named = options.strapi.strapiUrl && options.strapi.strapiApiToken ? await readNamedTheme(options.strapi) : {}
  const live = readLiveDigest(options.env.OUT_DIR)
  if (live) options.warn('theme.static', `The site published last is live on the theme package ${live}`)
  const started = startThemeSwitch({
    builtInDir: options.builtInDir,
    configured: options.configured,
    env: { ...options.env, MICELIO_THEME_STORE: options.builtInDir },
    onSwitch: () => undefined,
    warn: options.warn,
    ...(options.core && { core: options.core }),
    ...(live && { live }),
  })
  await started.ready
  return settleStaticTheme(started.themeSwitch, named)
}

/**
 * Makes the theme a build resolved the one the prerender renders: lists an installed theme in the store's index, which is rewritten, and names it as the default theme.
 *
 * @remarks
 * The prerender boots its own server, which reads `index.json` and loads `NUXT_PUBLIC_THEME` from it like any built-in theme, so without the listing it would stop
 * at a theme that is not in the store. A theme of the image is already listed; it only has to be named. `env` is the environment of the build, which the prerender inherits.
 */
export function adoptResolvedTheme(dir: string, index: BuiltInIndex, theme: StaticTheme, env: Record<string, string | undefined> = process.env): void {
  if (theme.source === 'installed') {
    Object.assign(index.themes, listInstalledTheme(index, theme).themes)
    writeFileSync(join(dir, BUILT_IN_INDEX), JSON.stringify(index))
  }
  if (theme.source !== 'default') env.NUXT_PUBLIC_THEME = theme.identity.id
}

/**
 * Copies the files of the theme `digest` that a visitor's browser needs out of the store's entry, and returns the folder.
 *
 * @remarks
 * The precompressed copies, the manifest and `runtime.json` stay out: the host and Nitro's own compression do the first, the others are for the server, and a static page has no script to read them.
 */
export function copyPublishedFiles(dir: string, digest: string): string {
  const files = join(dir, 'published', digest)
  cpSync(join(dir, STORE_DIR, 'entries', digest), files, { recursive: true, filter: source => !/(\.(gz|br)|manifest\.json|runtime\.json)$/.test(source) })
  return files
}
