import { lstatSync, readFileSync, realpathSync } from 'node:fs'
import { isAbsolute, join, relative, resolve } from 'node:path'

// Reads a theme's manual accessibility record for `theme:admit static` (#311). The file comes from the theme's repository, which is
// untrusted once the registry admits third-party themes (#312): nothing outside the checkout may reach the report through it.

/** The largest record read; a real one is a few KB. */
const RECORD_MAX_BYTES = 64 * 1024

/** What `readAccessibilityRecord` found, as the static result carries it to the report. */
export interface AccessibilityRead {
  /** The record's path as given, for messages. */
  accessibilityFile: string
  /** The parsed JSON, unvalidated (the report checks it); absent when there is no file or it could not be read. */
  accessibility?: unknown
  /** Why the file could not be read; never quotes its content. */
  accessibilityError?: string
}

/**
 * The manual accessibility record at `file`, or why it could not be read; a missing file is neither.
 *
 * @remarks
 * The path must stay inside `root` with no symlink anywhere below it, and the file must be a regular file of at most 64 KB. A parse
 * error is reported without its message, which quotes the text.
 *
 * @param file - The record's path, relative to the working directory or absolute.
 * @param root - The checkout the record must stay inside.
 */
export function readAccessibilityRecord(file: string, root: string): AccessibilityRead {
  const found = { accessibilityFile: file }
  const path = resolve(file)
  const inside = relative(resolve(root), path)
  if (!inside || inside.startsWith('..') || isAbsolute(inside)) return { ...found, accessibilityError: 'is outside the repository' }
  let text: string
  try {
    const entry = lstatSync(path, { throwIfNoEntry: false })
    if (!entry) return found
    if (!entry.isFile()) return { ...found, accessibilityError: 'is not a regular file (a symlink is not followed)' }
    // A symlinked folder on the way would pass lstat: the real path must be the path itself
    if (realpathSync(path) !== join(realpathSync(root), inside)) return { ...found, accessibilityError: 'is behind a symlink, which is not followed' }
    if (entry.size > RECORD_MAX_BYTES) return { ...found, accessibilityError: `is larger than ${RECORD_MAX_BYTES / 1024} KB` }
    text = readFileSync(path, 'utf8')
  } catch {
    // A folder on the way that is a file (ENOTDIR), a permission error: reported, so the other themes of the run go on
    return { ...found, accessibilityError: 'cannot be read' }
  }
  try {
    return { ...found, accessibility: JSON.parse(text) }
  } catch {
    return { ...found, accessibilityError: 'is not valid JSON' }
  }
}
