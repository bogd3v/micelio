import { reportSummary } from '../../modules/theme/admission/collect'
import { AdmissionReportSchema } from '../../modules/theme/admission/report'
import { THEME_VERSION } from '../../modules/theme/constants'
import { runsOn } from '../../modules/theme/registry/client'
import { THEME_DIGEST } from '../../modules/theme/registry/constants'
import { RegistryError } from '../../modules/theme/registry/error'
import { compareVersions } from '../../modules/theme/registry/semver'
import type { IndexVersion, RegistryIndex, ThemeRegistry } from '../../modules/theme/registry/types'
import type { CatalogueInstalledTheme, CatalogueReport, CatalogueTheme, CatalogueUpdate, ThemeCatalogue } from '../../app/interfaces/theme'
import type { ThemeCatalogueHolder } from './types'

// The theme catalogue of `GET /api/theme/catalogue` (#993): the stores of this server, the signed index of its registry and the admission
// reports the index names, read in the background at boot and then at most once an hour, never inside a request (ADR 0009, sections 3 and 6).

/** How often the index and the reports are read again. */
export const CATALOGUE_REFRESH_MS = 60 * 60_000

/** Most admission reports the catalogue reads and holds. */
const MAX_REPORTS = 50

/** A theme of one of the stores, before the index is matched. */
export type StoredTheme = Pick<CatalogueInstalledTheme, 'id' | 'version' | 'packageDigest' | 'contract' | 'code' | 'store'>

/** What `createThemeCatalogue` needs from the server. */
export interface CatalogueDeps {
  /** The themes of the built-in store and of the deployment store, read again at each refresh. */
  stored: () => Promise<StoredTheme[]>
  /** A registry client for one read, its requests bounded by the download deadline; `null` when nothing may be read from the registry. */
  registry: (() => ThemeRegistry) | null
  /** Why `registry` is `null`: one line with no URL and no path. */
  offReason?: string
  /** The version of the core, for the versions the index marks incompatible from some core on; the server passes none (`runsOn`). */
  core?: string
  /** Logs a failed read; `message` is fixed text and `cause` a failure code. */
  warn: (event: string, message: string, cause?: string) => void
}

/** The reason of a failed read: fixed text and the failure code, so it never carries a URL, a path or a token. */
function reasonOf(error: unknown): string {
  const failure = error instanceof RegistryError ? error.failure : 'network'
  const verifies = failure === 'signature' || failure === 'attestation' || failure === 'trust-root' || failure === 'signer'
  return `The registry's index ${verifies ? 'did not verify' : 'could not be read'} (${failure}); the last good catalogue stays`
}

function versionsOf(index: RegistryIndex, id: string): Array<[string, IndexVersion]> {
  const theme = Object.hasOwn(index.themes, id) ? index.themes[id] : undefined
  return theme ? Object.entries(theme.versions) : []
}

/** The entry the index lists for this version with this package digest, if any. */
function listedEntry(index: RegistryIndex | null, theme: StoredTheme): IndexVersion | undefined {
  if (!index) return undefined
  const found = versionsOf(index, theme.id).find(([version]) => version === theme.version)?.[1]
  return found?.digest === theme.packageDigest ? found : undefined
}

function newestFirst(a: [string, IndexVersion], b: [string, IndexVersion]): number {
  return compareVersions(b[0], a[0])
}

/** The reports to read: each installed version the index lists, then the newest `published` version of each theme; at most `MAX_REPORTS`, one per digest, and only digests of the sha256 grammar. */
function reportTargets(index: RegistryIndex, stored: StoredTheme[]): Array<Omit<CatalogueReport, 'ok' | 'summary'>> {
  const targets: Array<Omit<CatalogueReport, 'ok' | 'summary'>> = []
  const add = (id: string, version: string, entry: IndexVersion | undefined): void => {
    const report = entry && reportOf(entry).report
    if (report !== undefined && !targets.some(target => target.digest === report)) targets.push({ id, version, digest: report })
  }
  for (const theme of stored) add(theme.id, theme.version, listedEntry(index, theme))
  for (const id of Object.keys(index.themes).sort()) {
    const [newest] = versionsOf(index, id).filter(([, entry]) => entry.status === 'published').sort(newestFirst)
    if (newest) add(id, newest[0], newest[1])
  }
  return targets.slice(0, MAX_REPORTS)
}

/**
 * A report's summary with no URL query and no file system path: a message of an admission run may name a file of its runner, which the catalogue never passes on.
 * A URL keeps its origin and path; any other absolute path of two segments or more becomes `<path>`.
 */
function withoutPaths(summary: string): string {
  return summary.split(/(https?:\/\/[^\s)`'"<>]+)/).map((part, at) => (at % 2 === 1 ? part.replace(/[?#].*$/, '') : part.replace(/(?<![\w.~-])(?:[A-Za-z]:)?(?:[\\/][\w.@~+-]+){2,}[\\/]?/g, '<path>'))).join('')
}

/** The report digest of an entry, only when it has the sha256 grammar: the index allows any short text there, and the catalogue never passes one on. */
function reportOf(entry: IndexVersion): { report?: string } {
  return entry.report !== undefined && THEME_DIGEST.test(entry.report) ? { report: entry.report } : {}
}

function buildCatalogue(stored: StoredTheme[], index: RegistryIndex | null, reports: CatalogueReport[], reason: string | null, core: string | undefined): ThemeCatalogue {
  const installed = stored.map((theme): CatalogueInstalledTheme => {
    const entry = listedEntry(index, theme)
    return { ...theme, ...(entry && { tier: entry.tier, license: entry.license, ...reportOf(entry) }) }
  })
  const registry = index && Object.keys(index.themes).sort().map((id): CatalogueTheme => ({
    id,
    versions: versionsOf(index, id).sort(newestFirst).map(([version, entry]) => ({
      version,
      digest: entry.digest,
      contract: entry.contract,
      license: entry.license,
      tier: entry.tier,
      distribution: entry.distribution,
      status: entry.status,
      code: entry.code,
      ...reportOf(entry),
      runs: runsOn(entry, core),
    })),
  }))
  const updates = index
    ? stored.flatMap((theme): CatalogueUpdate[] => {
        if (!THEME_VERSION.test(theme.version)) return []
        const [newest] = versionsOf(index, theme.id)
          .filter(([version, entry]) => entry.status === 'published' && runsOn(entry, core) && compareVersions(version, theme.version) > 0)
          .sort(newestFirst)
        return newest ? [{ id: theme.id, from: theme.version, store: theme.store, version: newest[0], digest: newest[1].digest }] : []
      })
    : []
  return { installed, registry, reason, updates, reports }
}

/**
 * Creates the theme catalogue of this process (ADR 0009, sections 3 and 6).
 *
 * @remarks
 * Reading the catalogue installs, activates and evicts nothing. The index is read through the registry client of the server install (its
 * signer identity, guarded fetch and timeouts), and nothing in an index whose signature does not verify is used. A report is read by the
 * digest the index names; the client checks the bytes against it before they are parsed with the report's schema, and a report that
 * fails either is left out. A report already read is kept by its digest, so a refresh reads only the new ones.
 */
export function createThemeCatalogue(deps: CatalogueDeps): ThemeCatalogueHolder {
  let stored: StoredTheme[] = []
  let index: RegistryIndex | null = null
  let reason: string | null = deps.registry ? 'The registry\'s index has not been read yet' : (deps.offReason ?? 'The registry is not read')
  let reports = new Map<string, CatalogueReport>()
  let catalogue = buildCatalogue(stored, index, [], reason, deps.core)
  let chain: Promise<void> = Promise.resolve()

  function rebuild(): void {
    catalogue = buildCatalogue(stored, index, index ? reportTargets(index, stored).flatMap(target => reports.get(target.digest) ?? []) : [], reason, deps.core)
  }

  async function readStores(): Promise<void> {
    try {
      stored = await deps.stored()
    } catch (error) {
      deps.warn('theme.catalogue', 'The theme stores could not be listed; the catalogue keeps the last list', error instanceof Error ? error.name : undefined)
    }
  }

  async function readReport(registry: ThemeRegistry, target: Omit<CatalogueReport, 'ok' | 'summary'>): Promise<CatalogueReport | null> {
    try {
      const parsed = AdmissionReportSchema.safeParse(JSON.parse((await registry.report(target.id, target.digest)).toString('utf8')))
      if (!parsed.success) throw new RegistryError('registry', 'the report does not match its schema')
      return { ...target, ok: parsed.data.ok, summary: withoutPaths(reportSummary(parsed.data)) }
    } catch (error) {
      deps.warn('theme.catalogue', `The admission report of ${target.id}@${target.version} is left out`, error instanceof RegistryError ? error.failure : 'registry')
      return null
    }
  }

  async function readRegistry(): Promise<void> {
    if (!deps.registry) return
    const registry = deps.registry()
    try {
      index = await registry.index()
      reason = null
    } catch (error) {
      reason = reasonOf(error)
      deps.warn('theme.catalogue', 'The registry\'s index could not be read; the catalogue keeps the last good one', error instanceof RegistryError ? error.failure : 'network')
      return
    }
    const next = new Map<string, CatalogueReport>()
    for (const target of reportTargets(index, stored)) {
      const report = reports.get(target.digest) ?? await readReport(registry, target)
      if (report) next.set(target.digest, report)
    }
    reports = next
  }

  /** Runs `work` after the work already queued, then rebuilds; a relist asked for during a refresh still reads the stores after it. */
  function queued(work: () => Promise<void>): Promise<void> {
    const before = chain
    chain = (async () => {
      await before
      try {
        await work()
      } catch (error) {
        deps.warn('theme.catalogue', 'The theme catalogue could not be refreshed', error instanceof Error ? error.name : undefined)
      }
      rebuild()
    })()
    return chain
  }

  function refresh(): Promise<void> {
    return queued(async () => {
      await readStores()
      // The stores are listed before the registry answers, which may take up to its deadline
      rebuild()
      await readRegistry()
    })
  }

  return {
    current: () => catalogue,
    refresh,
    relist: () => queued(readStores),
    start() {
      void refresh()
      const timer = setInterval(() => void refresh(), CATALOGUE_REFRESH_MS)
      timer.unref()
      return () => clearInterval(timer)
    },
  }
}
