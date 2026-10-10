import type { DraftFilter, DraftListItem, DraftState, DraftViewState, PublishedVersion } from '../interfaces/draft'

/** The filters of the drafts list, in display order. */
export const DRAFT_FILTERS: readonly DraftFilter[] = ['all', 'never-published', 'modified']

const DRAFT_STATES: readonly DraftState[] = ['never-published', 'modified']

function time(value: string | null | undefined): number {
  const parsed = value ? new Date(value).getTime() : Number.NaN
  return Number.isNaN(parsed) ? 0 : parsed
}

/** Whether a value is a state that a draft can have: `never-published` or `modified`. */
export function isDraftState(value: unknown): value is DraftState {
  return DRAFT_STATES.includes(value as DraftState)
}

/**
 * A copy of the drafts sorted by their last update, the most recent first.
 *
 * @remarks
 * A missing or invalid date counts as the oldest.
 */
export function sortDrafts(drafts: DraftListItem[]): DraftListItem[] {
  return [...drafts].sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
}

/** The drafts in one filter. `all` returns the same list, and any other filter returns the drafts in that state. */
export function filterDrafts(drafts: DraftListItem[], filter: DraftFilter): DraftListItem[] {
  return filter === 'all' ? drafts : drafts.filter(draft => draft.state === filter)
}

/** How many drafts a filter shows. */
export function countDrafts(drafts: DraftListItem[], filter: DraftFilter): number {
  return filterDrafts(drafts, filter).length
}

/** The state of a draft compared with its published version: `never-published` when there is none, `modified` when the draft was updated after it, and `unchanged` otherwise. */
export function draftViewState(draftUpdatedAt: string | null | undefined, published: PublishedVersion | null): DraftViewState {
  if (!published) return 'never-published'
  return time(draftUpdatedAt) > time(published.updatedAt) ? 'modified' : 'unchanged'
}

/**
 * The camel case form of a draft state or filter, used as the last part of an i18n key.
 *
 * @remarks
 * For example, `never-published` becomes `neverPublished`.
 */
export function draftStateKey(state: DraftViewState | DraftFilter): string {
  return state.replace(/-(\w)/g, (_, letter: string) => letter.toUpperCase())
}
