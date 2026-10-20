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
