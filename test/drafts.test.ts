import { describe, expect, it } from 'vitest'
import type { DraftListItem } from '~/interfaces'
import { countDrafts, draftStateKey, draftViewState, filterDrafts, isDraftState, sortDrafts } from '~/helpers/drafts'
import { formatDotDateTime } from '~/helpers/formatDate'

function draft(documentId: string, state: DraftListItem['state'], updatedAt: string): DraftListItem {
  return { documentId, title: documentId, slug: documentId, locale: 'es', updatedAt, publishedAt: null, state, category: null, author: null }
}

const drafts: DraftListItem[] = [
  draft('old', 'modified', '2026-09-22T16:27:00.000Z'),
  draft('new', 'never-published', '2026-09-28T23:42:00.000Z'),
  draft('mid', 'never-published', '2026-09-25T10:00:00.000Z'),
]

describe('sortDrafts', () => {
  it('orders by last edit, newest first, without mutating the input', () => {
    expect(sortDrafts(drafts).map(item => item.documentId)).toEqual(['new', 'mid', 'old'])
    expect(drafts[0]!.documentId).toBe('old')
  })
})

describe('filterDrafts and countDrafts', () => {
  it('keeps every draft for all and filters by state otherwise', () => {
    expect(filterDrafts(drafts, 'all')).toHaveLength(3)
    expect(filterDrafts(drafts, 'never-published').map(item => item.documentId)).toEqual(['new', 'mid'])
    expect(countDrafts(drafts, 'modified')).toBe(1)
  })
})

describe('isDraftState', () => {
  it('accepts only the two list states', () => {
    expect(isDraftState('never-published')).toBe(true)
    expect(isDraftState('modified')).toBe(true)
    expect(isDraftState('unchanged')).toBe(false)
    expect(isDraftState(undefined)).toBe(false)
  })
})

describe('draftViewState', () => {
  const published = { slug: 'rag', updatedAt: '2026-09-26T10:23:37.913Z', publishedAt: '2026-09-26T10:23:37.913Z' }

  it('is never published without a published version', () => {
    expect(draftViewState('2026-09-27T09:15:00.000Z', null)).toBe('never-published')
  })

  it('is modified when the draft was edited after the published version', () => {
    expect(draftViewState('2026-09-27T09:15:00.000Z', published)).toBe('modified')
  })

  it('is unchanged when the draft is not newer than the published version', () => {
    expect(draftViewState(published.updatedAt, published)).toBe('unchanged')
  })
})

describe('draftStateKey', () => {
  it('turns states into camelCase translation keys', () => {
    expect(draftStateKey('never-published')).toBe('neverPublished')
    expect(draftStateKey('modified')).toBe('modified')
    expect(draftStateKey('all')).toBe('all')
  })
})

describe('formatDotDateTime', () => {
  it('formats date and time in the given zone', () => {
    expect(formatDotDateTime('2026-09-28T23:42:00.000Z', 'America/Bogota')).toBe('28.09.2026 · 18:42')
    expect(formatDotDateTime('2026-09-29T04:05:00.000Z', 'America/Bogota')).toBe('28.09.2026 · 23:05')
  })

  it('returns an empty string without a date', () => {
    expect(formatDotDateTime(null)).toBe('')
  })
})
