/** Where the ids of the articles a visitor already read are stored. */
export const READ_STORAGE_KEY = 'micelio-read-articles'
// TODO(#422): remove the bd-read-articles fallback
const LEGACY_READ_STORAGE_KEY = 'bd-read-articles'
export const READ_THRESHOLD = 0.6
export const READ_MAX_ENTRIES = 500

type ReadStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function browserStorage(): ReadStorage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage
  } catch {
    return null
  }
}

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

export function withReadId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids : [...ids, id].slice(-READ_MAX_ENTRIES)
}

export function readRatio(top: number, height: number, viewportHeight: number): number {
  if (height <= 0) return 0
  return Math.min(1, Math.max(0, (viewportHeight - top) / height))
}
