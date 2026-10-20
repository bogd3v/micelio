// The limits several files of the package code share (ADR 0008 decision 1; ADR 0009, section 2 "Safe unpack").
// A limit or pattern that one file alone uses stays in that file.

/** Largest sum of the file sizes of a package (ADR 0008). */
export const MAX_UNPACKED_BYTES = 4 * 1024 * 1024

/** Largest single file of a package (ADR 0008). */
export const MAX_FILE_BYTES = 1024 * 1024

/** Most entries in a package, directories included (ADR 0008). */
export const MAX_ENTRIES = 200

/** The `theme.json` of a package. */
export const THEME_JSON = 'theme.json'

/** Largest `.tgz` read at all: a download stops here while streaming, and the unpack checks it again before decompressing (ADR 0009, section 2). */
export const MAX_COMPRESSED_BYTES = 2 * 1024 * 1024

/** The format of a package digest: `sha256:` and 64 lowercase hex digits. */
export const THEME_DIGEST = /^sha256:[0-9a-f]{64}$/

/** The lock of the themes a site pins, at the repository root (ADR 0008, decision 5). */
export const LOCK_FILE = 'themes.lock.json'

/** Where `theme:pull` installs the locked themes, relative to the repository root; gitignored. */
export const PULLED_THEMES_DIR = '.micelio/themes'

/** The registry used when `MICELIO_THEME_REGISTRY` is not set (ADR 0008, decision 4). */
export const DEFAULT_REGISTRY = 'ghcr.io/bogd3v/micelio-themes'

/** The repository, under the registry, that holds the index; a theme cannot take this id. */
export const INDEX_REPOSITORY = 'index'

/** The tag of the index artifact: the version of its format, so a new format never replaces the one an old core reads. */
export const INDEX_TAG = 'v1'

/** Media type of the single layer of a theme package artifact (the `.tgz` itself). */
export const PACKAGE_MEDIA_TYPE = 'application/vnd.micelio.theme.package.v1.tar+gzip'

/** Media type of the single layer of the index artifact. */
export const INDEX_MEDIA_TYPE = 'application/vnd.micelio.theme.index.v1+json'

/** Largest index read, in bytes, while streaming. */
export const MAX_INDEX_BYTES = 1024 * 1024
