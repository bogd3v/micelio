import { describe, it, expect } from 'vitest'
import { READ_MAX_ENTRIES, READ_STORAGE_KEY, loadReadIds, parseReadIds, readRatio, saveReadIds, withReadId } from '../app/helpers/readArticles'

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => { data.set(key, value) },
    removeItem: (key: string) => { data.delete(key) },
  }
}

const brokenStorage = {
  getItem: () => { throw new Error('SecurityError') },
  setItem: () => { throw new Error('QuotaExceededError') },
  removeItem: () => { throw new Error('SecurityError') },
}

describe('parseReadIds', () => {
  it('keeps unique non-empty string ids', () => {
    expect(parseReadIds('["a","b","a","",3,null,"c"]')).toEqual(['a', 'b', 'c'])
  })

  it('ignores missing, malformed or unexpected values', () => {
    expect(parseReadIds(null)).toEqual([])
    expect(parseReadIds('not json')).toEqual([])
    expect(parseReadIds('{"a":1}')).toEqual([])
  })

  it('keeps only the most recent entries', () => {
    const ids = Array.from({ length: READ_MAX_ENTRIES + 5 }, (_, index) => `doc-${index}`)
    const parsed = parseReadIds(JSON.stringify(ids))
    expect(parsed).toHaveLength(READ_MAX_ENTRIES)
    expect(parsed[0]).toBe('doc-5')
  })
})

describe('loadReadIds and saveReadIds', () => {
  it('round-trips the ids through the storage', () => {
    const storage = memoryStorage()
    expect(saveReadIds(['doc-a', 'doc-b'], storage)).toBe(true)
    expect(storage.data.get(READ_STORAGE_KEY)).toBe('["doc-a","doc-b"]')
    expect(loadReadIds(storage)).toEqual(['doc-a', 'doc-b'])
  })

  it('removes the key when the history is cleared', () => {
    const storage = memoryStorage({ [READ_STORAGE_KEY]: '["doc-a"]' })
    expect(saveReadIds([], storage)).toBe(true)
    expect(storage.data.has(READ_STORAGE_KEY)).toBe(false)
  })

  it('does not fail when the storage is unavailable or throws', () => {
    expect(loadReadIds(null)).toEqual([])
    expect(saveReadIds(['doc-a'], null)).toBe(false)
    expect(loadReadIds(brokenStorage)).toEqual([])
    expect(saveReadIds(['doc-a'], brokenStorage)).toBe(false)
    expect(saveReadIds([], brokenStorage)).toBe(false)
  })
})

describe('read marks migration', () => {
  it('reads the pre-rename key, writes the new one and removes the old one', () => {
    const storage = memoryStorage({ 'bd-read-articles': '["a","b"]' })
    expect(loadReadIds(storage)).toEqual(['a', 'b'])
    expect(Object.fromEntries(storage.data)).toEqual({ [READ_STORAGE_KEY]: '["a","b"]' })
  })

  it('prefers the new key and leaves the old one for the next save', () => {
    const storage = memoryStorage({ [READ_STORAGE_KEY]: '["new"]', 'bd-read-articles': '["old"]' })
    expect(loadReadIds(storage)).toEqual(['new'])
    expect(saveReadIds(['new', 'more'], storage)).toBe(true)
    expect(Object.fromEntries(storage.data)).toEqual({ [READ_STORAGE_KEY]: '["new","more"]' })
  })

  it('never writes the old key, and a cleared history removes both', () => {
    const storage = memoryStorage({ 'bd-read-articles': '["a"]' })
    saveReadIds(['a', 'b'], storage)
    expect([...storage.data.keys()]).toEqual([READ_STORAGE_KEY])
    saveReadIds([], memoryStorage({ 'bd-read-articles': '["a"]' }))
    const cleared = memoryStorage({ [READ_STORAGE_KEY]: '["a"]', 'bd-read-articles': '["a"]' })
    saveReadIds([], cleared)
    expect(cleared.data.size).toBe(0)
  })

  it('ignores a malformed pre-rename value without writing', () => {
    const storage = memoryStorage({ 'bd-read-articles': 'nope' })
    expect(loadReadIds(storage)).toEqual([])
    expect(Object.fromEntries(storage.data)).toEqual({ 'bd-read-articles': 'nope' })
  })
})

describe('withReadId', () => {
  it('adds a new id and returns the same list when it is already there', () => {
    const ids = ['doc-a']
    expect(withReadId(ids, 'doc-b')).toEqual(['doc-a', 'doc-b'])
    expect(withReadId(ids, 'doc-a')).toBe(ids)
  })
})

describe('readRatio', () => {
  it('measures how much of the article the viewport has reached', () => {
    expect(readRatio(800, 1000, 800)).toBe(0)
    expect(readRatio(200, 1000, 800)).toBe(0.6)
    expect(readRatio(-500, 1000, 800)).toBe(1)
    expect(readRatio(0, 0, 800)).toBe(0)
  })
})
