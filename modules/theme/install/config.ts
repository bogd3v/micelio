import { isAbsolute, resolve } from 'node:path'

/** What the operator's variables say about installing themes at runtime (ADR 0009, section 9). */
export interface InstallConfig {
  /** The deployment store, or `null` when `MICELIO_THEME_STORE` is unset: only built-in themes activate. */
  storeDir: string | null
  /** Whether the server may install themes: `MICELIO_THEME_INSTALL` (on by default) and a store. */
  installEnabled: boolean
  /** Lines to log once at boot, at warn level. */
  warnings: string[]
}

const TRUE = new Set(['true', '1'])
const FALSE = new Set(['false', '0'])

/**
 * Reads `MICELIO_THEME_STORE` and `MICELIO_THEME_INSTALL`, or throws a message that names the variable.
 *
 * @remarks
 * Unset, the store gives no deployment store: the server installs nothing whatever `MICELIO_THEME_INSTALL` says, and one warning
 * says so. The store must be an absolute path, so a change of working directory never moves it.
 *
 * @param env - The environment to read, `process.env` in a server.
 * @throws `Error` when the store is a relative path or the switch is not `true`, `false`, `1` or `0`.
 */
export function readInstallConfig(env: Record<string, string | undefined>): InstallConfig {
  const store = env.MICELIO_THEME_STORE?.trim()
  if (store && !isAbsolute(store)) throw new Error('MICELIO_THEME_STORE must be an absolute path')
  const raw = env.MICELIO_THEME_INSTALL?.trim().toLowerCase()
  if (raw && !TRUE.has(raw) && !FALSE.has(raw)) throw new Error('MICELIO_THEME_INSTALL must be true, false, 1 or 0')
  const switchedOn = raw === undefined || raw === '' || TRUE.has(raw)
  if (!store) {
    return {
      storeDir: null,
      installEnabled: false,
      warnings: ['MICELIO_THEME_INSTALL has no effect without MICELIO_THEME_STORE: only the themes built into the image activate and the server installs nothing'],
    }
  }
  return { storeDir: resolve(store), installEnabled: switchedOn, warnings: [] }
}
