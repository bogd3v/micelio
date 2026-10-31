import { InstallError } from '../../../modules/theme/install/error'
import { installedEntry } from '../../../modules/theme/install/installed'
import { parseRuntime } from '../../../modules/theme/install/runtime'
import { ENTRY_FILES } from '../../../modules/theme/install/constants'
import { loadEntry } from '../../../modules/theme/install/store'
import type { LoadedEntry } from '../../../modules/theme/install/types'
import { RegistryError } from '../../../modules/theme/registry/error'
import { pinProblem } from '../../../modules/theme/registry/pin'
import type { ThemePin } from '../../../modules/theme/registry/types'
import type { BuiltInTheme } from '../types'
import { DOWNLOAD_TIMEOUT_MS, MAX_REASON_LENGTH, PREVIOUS_SERVED, PREVIOUS_SERVED_MS } from './constants'
import { createInstallLimiter, storeFull } from './limits'
import type { InstallLimiter } from './limits'
import type { RequestedTheme, ThemeIdentity, ThemeStatus, ThemeSwitchFailure, ThemeSwitchRule } from '~/interfaces/theme'
import type { PersistedPins, SwitchDeps, ThemeSwitch } from './types'

// The active theme of the server: one state every reader uses, switched atomically and only to a theme that is already verified and in memory (ADR 0009, sections 3 to 6).
// Nothing here waits for the network inside a request: `observe` starts the work in the background and returns.

/** A switch that did not happen, with the rule that refused it. */
class SwitchError extends Error {
  /** `silent` is a refusal that changes nothing the CMS reads: the earlier reason stays and nothing is logged again. */
  constructor(readonly rule: ThemeSwitchRule, message: string, readonly retryable = false, readonly silent = false) {
    super(message)
  }
}

type Wanted
  = | { kind: 'default' }
    | { kind: 'id', id: string }
    | { kind: 'pin', pin: ThemePin }

type Target = Wanted | { kind: 'invalid', requested: RequestedTheme, reason: string }

/** Milliseconds before the same request is tried again after a failure that may pass (a registry that was down). */
const RETRY_AFTER_MS = 60_000

/** The text of a failure on one line, without a URL or a control character, short enough for the status. */
function oneLine(text: string): string {
  const printable = [...text.replace(/https?:\/\/\S+/gi, '<url>').replace(/(?:\/[\w.@~-]+){2,}\/?/g, '<path>')].map(char => (char.charCodeAt(0) < 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159) ? ' ' : char)).join('')
  return printable.replace(/ {2,}/g, ' ').trim().slice(0, MAX_REASON_LENGTH)
}

/** The target the site settings name. A partial pin is invalid; an invalid pin never reaches a request or a path. */
function targetOf(raw: { themeId?: string, themeVersion?: string, themeDigest?: string } | null | undefined): Target {
  const id = raw?.themeId?.trim() ?? ''
  const version = raw?.themeVersion?.trim() ?? ''
  const digest = raw?.themeDigest?.trim() ?? ''
  if (id === '' && version === '' && digest === '') return { kind: 'default' }
  const requested: RequestedTheme = { id, ...(version && { version }), ...(digest && { digest }) }
  if (id === '') return { kind: 'invalid', requested, reason: 'themeVersion and themeDigest need a themeId' }
  if (version === '' && digest === '') {
    const problem = pinProblem({ id, version: '0.0.0', digest: `sha256:${'0'.repeat(64)}` })
    return problem === null ? { kind: 'id', id } : { kind: 'invalid', requested, reason: oneLine(problem) }
  }
  const pin = { id, version, digest }
  const problem = pinProblem(pin)
  return problem === null ? { kind: 'pin', pin } : { kind: 'invalid', requested, reason: oneLine(problem) }
}

/** What the site settings ask for, as the status shows it; `null` for the default theme. */
function requestedOf(target: Target): RequestedTheme | null {
  return target.kind === 'default' ? null : target.kind === 'invalid' ? target.requested : target.kind === 'id' ? { id: target.id } : { ...target.pin }
}

function identityOf(theme: BuiltInTheme): ThemeIdentity {
  const { runtime, entry } = theme
  return { id: runtime.id, ...(runtime.version && { version: runtime.version }), digest: runtime.digest, packageDigest: theme.pinned ?? entry.manifest.packageDigest }
}

/** Whether a built-in theme is the package a pin names: by the digest of its entry's package, or by the digest the image's lock pins for it. */
function isPackage(theme: BuiltInTheme, pin: ThemePin): boolean {
  return theme.entry.manifest.packageDigest === pin.digest || theme.pinned === pin.digest
}

function samePin(a: ThemePin | null, b: ThemePin): boolean {
  return a !== null && a.id === b.id && a.version === b.version && a.digest === b.digest
}

/** The theme of a verified entry of a package, or throws: it must be the pinned data-only package. */
function themeOfEntry(entry: LoadedEntry, pin: ThemePin): BuiltInTheme {
  const file = entry.files.get(ENTRY_FILES.runtime)
  if (file === undefined) throw new SwitchError('integrity', 'the installed entry has no runtime data')
  let runtime
  try {
    runtime = parseRuntime(file, entry.manifest.digest)
  } catch (error) {
    throw new SwitchError('integrity', oneLine((error as Error).message))
  }
  if (entry.manifest.packageDigest !== pin.digest || runtime.id !== pin.id || entry.manifest.id !== pin.id) throw new SwitchError('integrity', 'the installed entry is not the pinned package')
  if (entry.manifest.code || runtime.code) throw new SwitchError('code', 'the theme ships code, which only an image built with it can run')
  return { entry, runtime }
}

/**
 * Creates the server's theme switch around the instance's default theme.
 *
 * @remarks
 * `observe` reads what the site settings ask for and, in the background and one at a time (the latest request wins), resolves it:
 * a theme of the built-in store, an entry the deployment store already holds, or, when installing is on, a download. Only a theme that
 * is complete in memory becomes active, so a failed check, a download or an unknown theme leaves the current one and records the
 * reason. The pin is checked first; a code theme activates only from the built-in store at the digest the image was built with; a
 * data-only theme whose id is a compiled-in code theme's is refused, since the slots are chosen by id (ADR 0009, amendment of 2026-10-23).
 *
 * @param limiter - The install rate and backoff; one per process by default.
 */
export function createThemeSwitch(deps: SwitchDeps, limiter: InstallLimiter = createInstallLimiter(deps.now)): ThemeSwitch {
  let active = deps.defaultTheme()
  let activePin: ThemePin | null = null
  let lastGood: BuiltInTheme | null = null
  let lastGoodPin: ThemePin | null = null
  let retired: Array<{ theme: BuiltInTheme, until: number }> = []
  let requested: RequestedTheme | null = null
  let error: ThemeSwitchFailure | null = null
  let retryAfter = 0
  let seen = ''
  let queued: Wanted | null = null
  let running: Promise<void> | null = null
  // `observe` records what the site settings ask for at once, but resolves it only after the boot work, which decides what the remembered themes are
  let gate: Promise<void> = Promise.resolve()

  function fail(rule: ThemeSwitchRule, message: string, asked: RequestedTheme | null = requested): void {
    error = { rule, message: oneLine(message), at: new Date(deps.now()).toISOString(), requested: asked }
    deps.warn('theme.switch', 'The theme the site settings name was not activated; the current theme stays', `${rule}: ${error.message}`)
  }

  function activate(theme: BuiltInTheme, pin: ThemePin | null): void {
    error = null
    if (theme === active) {
      activePin = pin
      return
    }
    const from = active
    retired = [{ theme: from, until: deps.now() + PREVIOUS_SERVED_MS }, ...retired.filter(old => old.theme !== theme)].slice(0, PREVIOUS_SERVED)
    lastGood = from
    lastGoodPin = activePin
    active = theme
    activePin = pin
    deps.onSwitch({ from, to: theme })
    void remember({ active: pin, lastGood: lastGoodPin })
  }

  async function remember(pins: PersistedPins): Promise<void> {
    if (!deps.persist) return
    try {
      await deps.persist(pins)
    } catch (cause) {
      deps.warn('theme.persist', 'The active theme could not be saved; a restart starts on the default theme until the site settings are read', oneLine((cause as Error).message))
    }
  }

  /** What is already on this machine for `pin`: a built-in theme at that package digest, or an entry the store holds as installed. Never the network. */
  async function local(pin: ThemePin): Promise<BuiltInTheme | null> {
    const built = deps.builtIn(pin.id)
    if (built && isPackage(built, pin)) return built
    const { install } = deps
    if (!install || built?.runtime.code) return null
    const registry = install.registry(AbortSignal.abort())
    const entry = await installedEntry(install.storeDir, pin, install.options.coreBuild, bundle => registry.verify(pin, bundle))
    return entry === null ? null : themeOfEntry(entry, pin)
  }

  async function download(pin: ThemePin): Promise<BuiltInTheme> {
    const { install } = deps
    if (!install?.enabled) throw new SwitchError('off', install ? 'the theme is not in the theme store and installing themes is off (MICELIO_THEME_INSTALL)' : 'the theme is not built into this image and no theme store is set (MICELIO_THEME_STORE)')
    const refusal = limiter.refusal(pin)
    if (refusal) {
      // A pin in backoff keeps the reason it failed with; only a new refusal is news
      throw new SwitchError('limit', refusal.message, true, refusal.kind === 'backoff' && error?.requested?.digest === pin.digest && error.requested.id === pin.id)
    }
    const full = await storeFull(install.storeDir)
    if (full) throw new SwitchError('limit', full, true)
    limiter.begin()
    const deadline = new AbortController()
    const timer = setTimeout(() => deadline.abort(), DOWNLOAD_TIMEOUT_MS)
    try {
      const registry = install.registry(deadline.signal)
      const listed = await registry.listed(pin)
      if (listed === undefined) throw new SwitchError('registry', 'the registry index does not list this version with this digest', true)
      if (!install.tiers.has(listed.tier)) throw new SwitchError('tier', `the tier "${listed.tier}" of this theme is not installed here; this instance installs: ${[...install.tiers].join(', ')} (MICELIO_THEME_TIERS)`)
      if (listed.code) throw new SwitchError('code', 'the theme ships code, which only an image built with it can run')
      if (listed.distribution !== 'public') throw new SwitchError('registry', 'only public themes are installed by a server')
      const fetched = await registry.fetch(pin, { locked: samePin(activePin, pin) || samePin(lastGoodPin, pin) })
      clearTimeout(timer)
      const result = await install.run({ kind: 'package', data: fetched.data, pin, attestation: fetched.bundle }, install.options)
      const entry = await loadEntry(install.storeDir, result.digest)
      if (entry === null) throw new SwitchError('integrity', 'the installed entry is not in the store')
      const theme = themeOfEntry(entry, pin)
      limiter.succeed(pin)
      return theme
    } catch (cause) {
      limiter.fail(pin)
      if (cause instanceof SwitchError) throw cause
      if (cause instanceof RegistryError) throw new SwitchError('registry', cause.detail, true)
      if (cause instanceof InstallError) throw new SwitchError(cause.rule === 'code' ? 'code' : 'install', cause.detail, cause.rule === 'compile' || cause.rule === 'busy')
      throw new SwitchError('install', 'the install failed unexpectedly', true)
    } finally {
      clearTimeout(timer)
    }
  }

  async function resolve(target: Wanted): Promise<{ theme: BuiltInTheme, pin: ThemePin | null }> {
    if (target.kind === 'default') return { theme: deps.defaultTheme(), pin: null }
    if (target.kind === 'id') {
      const built = deps.builtIn(target.id)
      if (!built) throw new SwitchError('unknown', `theme "${target.id}" is not built into this image; the site settings must name its version and digest to install it`)
      return { theme: built, pin: null }
    }
    const { pin } = target
    if (samePin(activePin, pin)) return { theme: active, pin }
    const found = await local(pin)
    if (found) return { theme: found, pin }
    const built = deps.builtIn(pin.id)
    if (built?.runtime.code) throw new SwitchError('code', `theme "${pin.id}" ships code and this image was built with another version of it: a code theme runs only on an image built with its exact package`)
    return { theme: await download(pin), pin }
  }

  async function attempt(target: Wanted): Promise<void> {
    try {
      const { theme, pin } = await resolve(target)
      activate(theme, pin)
      retryAfter = 0
    } catch (cause) {
      const failure = cause instanceof SwitchError ? cause : new SwitchError('install', 'the theme could not be activated', true)
      if (!failure.silent) fail(failure.rule, failure.message, requestedOf(target))
      retryAfter = failure.retryable ? deps.now() + RETRY_AFTER_MS : 0
    }
  }

  async function drain(): Promise<void> {
    await gate
    while (queued) {
      const next = queued
      queued = null
      await attempt(next)
    }
  }

  return {
    active: () => active,
    served(digest) {
      const now = deps.now()
      if (active.runtime.digest === digest) return active
      if (lastGood?.runtime.digest === digest) return lastGood
      return retired.find(old => old.until > now && old.theme.runtime.digest === digest)?.theme
    },
    observe(raw) {
      const target = targetOf(raw)
      const key = JSON.stringify(target)
      if (key === seen) {
        // The same request again: try once more only when the last failure may pass (a registry that was down)
        if (retryAfter === 0 || deps.now() < retryAfter || running || target.kind === 'invalid') return
        retryAfter = 0
      }
      seen = key
      requested = requestedOf(target)
      if (target.kind === 'invalid') {
        fail('pin', `the pin in the site settings is not valid and is ignored: ${target.reason}`)
        return
      }
      queued = target
      running ??= (async (): Promise<void> => {
        try {
          await drain()
        } finally {
          running = null
        }
      })()
    },
    hold(until) {
      gate = until
    },
    async restore(pins) {
      for (const [pin, role] of [[pins.lastGood, 'lastGood'], [pins.active, 'active']] as const) {
        if (pin === null) continue
        let found: BuiltInTheme | null = null
        try {
          found = await local(pin)
        } catch (cause) {
          deps.warn('theme.restore', 'A remembered theme could not be loaded', oneLine((cause as Error).message))
        }
        if (found === null) continue
        if (role === 'lastGood') {
          lastGood = found
          lastGoodPin = pin
        } else {
          active = found
          activePin = pin
        }
      }
    },
    reset() {
      active = deps.defaultTheme()
      activePin = null
      lastGood = null
      lastGoodPin = null
      retired = []
      requested = null
      error = null
      retryAfter = 0
      seen = ''
    },
    async settled(timeoutMs) {
      if (!running) return
      let timer: ReturnType<typeof setTimeout> | undefined
      await Promise.race([running, new Promise<void>((done) => {
        timer = setTimeout(done, timeoutMs)
      })])
      clearTimeout(timer)
    },
    status(): ThemeStatus {
      const { install } = deps
      return {
        active: identityOf(active),
        requested,
        lastGood: lastGood ? identityOf(lastGood) : null,
        error,
        available: {
          builtIn: deps.builtInList().map(({ id, version, code }) => ({ id, version, code })),
          registry: { install: install?.enabled === true, tiers: install ? [...install.tiers] : [] },
        },
      }
    },
  }
}
