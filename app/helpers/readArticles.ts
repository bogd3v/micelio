/** Where the ids of the articles a visitor already read are stored. */
export const READ_STORAGE_KEY = 'micelio-read-articles'
// TODO(#422): remove the bd-read-articles fallback
const LEGACY_READ_STORAGE_KEY = 'bd-read-articles'
/** The share of an article that a reader must pass before it counts as read, from 0 to 1. */
export const READ_THRESHOLD = 0.6
/** The most article ids kept in storage. The oldest ids are dropped first. */
export const READ_MAX_ENTRIES = 500

type ReadStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): ReadStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

/**
 * The unique article ids in a stored JSON array, the most recent `READ_MAX_ENTRIES` at most.
 *
 * @remarks
 * Any other value, or invalid JSON, gives an empty list.
 */
export function parseReadIds(raw: string | null): string[] {
  if (!raw) return []
  try {
    const value: unknown = JSON.parse(raw)
    if (!Array.isArray(value)) return []
    const ids = value.filter((id): id is string => typeof id === 'string' && id.length > 0)
    return [...new Set(ids)].slice(-READ_MAX_ENTRIES)
  } catch {
    return []
  }
}

/**
 * The ids of the articles already read, from storage.
 *
 * @remarks
 * An empty list is returned when there is no storage or it cannot be read. When only the legacy key holds ids, they are saved under the current key, and the legacy key is removed.
 *
 * @param storage - The storage to read from. Defaults to `localStorage`, and null when the browser has none.
 */
export function loadReadIds(storage: ReadStorage | null = browserStorage()): string[] {
  try {
    if (!storage) return []
    const current = storage.getItem(READ_STORAGE_KEY)
    if (current !== null) return parseReadIds(current)
    // TODO(#422): remove the bd-read-articles fallback
    const ids = parseReadIds(storage.getItem(LEGACY_READ_STORAGE_KEY))
    if (ids.length > 0) saveReadIds(ids, storage)
    return ids
  } catch {
    return []
  }
}

/**
 * Stores the article ids, keeping the most recent `READ_MAX_ENTRIES`, and removes the legacy key. Returns false when there is no storage or a storage call throws.
 *
 * @remarks
 * An empty list removes the stored key.
 *
 * @param storage - The storage to write to. Defaults to `localStorage`, and null when the browser has none.
 */
export function saveReadIds(ids: string[], storage: ReadStorage | null = browserStorage()): boolean {
  if (!storage) return false
  try {
    if (ids.length === 0) storage.removeItem(READ_STORAGE_KEY)
    else storage.setItem(READ_STORAGE_KEY, JSON.stringify(ids.slice(-READ_MAX_ENTRIES)))
    storage.removeItem(LEGACY_READ_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

/** The ids with the article id added as the most recent entry, capped at `READ_MAX_ENTRIES`. The same list is returned when the id is already there. */
export function withReadId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id].slice(-READ_MAX_ENTRIES)
}

/**
 * How much of an element a reader has passed: the share of its height that lies above the bottom edge of the viewport, from 0 to 1.
 *
 * @param top - The distance in pixels from the top of the viewport to the top of the element.
 * @param height - The height of the element in pixels. A height of 0 or less gives 0.
 * @param viewportHeight - The height of the viewport in pixels.
 */
export function readRatio(top: number, height: number, viewportHeight: number): number {
  if (height <= 0) return 0
  return Math.min(1, Math.max(0, (viewportHeight - top) / height))
}
