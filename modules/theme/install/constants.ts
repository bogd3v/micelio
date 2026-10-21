// What several files of the install code share (ADR 0009, sections 1 and 2). A value one file alone uses stays in that file.

/**
 * Browser targets of the CSS the core ships, shared by the Nuxt build and the theme compiler so the same stylesheet lowers the same way.
 * Each entry is `[major, minor?]`.
 */
export const CSS_TARGETS: Record<string, [major: number, minor?: number]> = {
  chrome: [111],
  edge: [111],
  firefox: [114],
  safari: [16, 4],
  ios_saf: [16, 4],
}

/** Layout of the store on disk: a change to it is a new directory name, so two cores never read each other's entries. */
export const STORE_VERSION = 1

/** Version of the theme compiler: raise it whenever the same theme would compile to different bytes. Part of the compile key. */
export const COMPILER_VERSION = 1

/** The folder of the store a layout version uses, under the store root. */
export const STORE_DIR = `v${STORE_VERSION}`

/** The URL prefix a store entry is served under: `/_t/<digest>/`. */
export const SERVE_PREFIX = '/_t'

/** The digest of a compiled entry, as it appears in its URL and in the name of its folder: 64 lowercase hex digits. */
export const COMPILED_DIGEST = /^[0-9a-f]{64}$/

/** The name of the integrity manifest inside a compiled entry. */
export const ENTRY_MANIFEST = 'manifest.json'

/** The stylesheets and data a compiled entry holds besides `fonts/` and `images/`. */
export const ENTRY_FILES = { theme: 'theme.css', sections: 'sections.css', runtime: 'runtime.json' } as const

/** Largest stylesheet the compiler produces, after bundling its imports. */
export const MAX_COMPILED_CSS_BYTES = 1024 * 1024

/** Largest sum of the compiled messages of all locales of a theme, as JSON. */
export const MAX_MESSAGES_BYTES = 512 * 1024

/** The only top-level key a theme's messages may use (ADR 0009, section 2). */
export const MESSAGE_NAMESPACE = 'theme'

/** Milliseconds an install may run before its process is killed, and the lease of its lock (ADR 0009, section 2). */
export const INSTALL_LEASE_MS = 60_000

/** Heap, in MiB, an install process may use before it is stopped. */
export const INSTALL_HEAP_MB = 256

/** Extensions of the files that get a gzip and a brotli copy next to them. */
export const PRECOMPRESSED = /\.(css|json|svg|txt)$/i

/** Most bytes the files of a compiled entry may hold, not counting their gzip and brotli copies (ADR 0009, section 2). */
export const MAX_ENTRY_BYTES = 4 * 1024 * 1024

/** Most bytes a loader keeps in memory for one entry: the files and their precompressed copies, at most twice the cap above. */
export const MAX_LOADED_BYTES = 2 * MAX_ENTRY_BYTES

/** Largest `manifest.json` a loader reads. */
export const MAX_ENTRY_MANIFEST_BYTES = 1024 * 1024

/** The index of the built-in store, inside its folder. */
export const BUILT_IN_INDEX = 'index.json'

/** Where the built-in store sits next to the server entry of a production build (`.output/server/micelio/store`). */
export const BUILT_IN_STORE_PATH = 'micelio/store'
