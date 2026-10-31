// What several files of the theme switch share (ADR 0009, section 3 and the amendment of 2026-10-20 on the limits). A value one file alone uses stays in that file.

/** Most entries the deployment store may hold; at the cap an install is refused and a request never evicts anything. */
export const STORE_MAX_ENTRIES = 50

/** Most bytes the entries and the kept packages of the deployment store may hold together. */
export const STORE_MAX_BYTES = 256 * 1024 * 1024

/** Installs one instance starts per hour; the boot recompiles do not count. */
export const INSTALLS_PER_HOUR = 6

/** Wait after the first failed install of a pin; it doubles with each failure up to `BACKOFF_MAX_MS`. */
export const BACKOFF_FIRST_MS = 60_000

/** Longest wait after a failed pin. */
export const BACKOFF_MAX_MS = 60 * 60_000

/** Pins whose failures are remembered; the least recently failed is forgotten first. */
export const BACKOFF_TRACKED = 200

/** Milliseconds the download of one package may take in all: the index, the manifest, the blob and both attestations. */
export const DOWNLOAD_TIMEOUT_MS = 60_000

/** How long `/_t/` still serves a digest after a switch: the longest page cache window (3,600 s) plus the site-settings cache (60 s). */
export const PREVIOUS_SERVED_MS = 3_660_000

/** How many digests from before a switch `/_t/` keeps serving. */
export const PREVIOUS_SERVED = 2

/** The tiers a server installs when `MICELIO_THEME_TIERS` is unset. */
export const DEFAULT_TIERS = ['official', 'verified'] as const

/** Longest reason the status carries; a reason is one line and holds no URL. */
export const MAX_REASON_LENGTH = 300

/** The file in the deployment store (under its layout folder) that remembers the active and last good pins across restarts. */
export const STATE_FILE = 'state.json'
