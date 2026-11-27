import type { H3Event } from 'h3'
import qs from 'qs'
import { REUSABLE_BLOCK_POPULATE } from '../lib/constants'
import { parseReusableTarget } from '../schemas/page'
import type { PageContext } from '../schemas/page'

/** The entries of the reusable blocks the CMS answered, as it sent them, by document id; a document id it did not answer has none. */
export type ReusableTargetEntries = ReadonlyMap<string, unknown>

/** The document id of the target of a reference that carries no block yet, parsed or as the CMS sent it; `undefined` for any other section. */
function unresolvedTarget(section: unknown): string | undefined {
  if (!section || typeof section !== 'object') return undefined
  const { __component, block, reusableBlock } = section as { __component?: unknown, block?: unknown, reusableBlock?: { documentId?: unknown, blocks?: unknown } | null }
  // A relation that carries its `blocks` zone is the target itself (a grant bound to a reference reads the page so)
  if (__component !== 'section.reusable' || block || Array.isArray(reusableBlock?.blocks)) return undefined
  const documentId = reusableBlock?.documentId
  return typeof documentId === 'string' && documentId ? documentId : undefined
}

/**
 * The distinct document ids of the reusable blocks the references of `sections` point at, in the order they first appear; `sections` are parsed or as the CMS sent them.
 *
 * @remarks
 * A reference that already carries its block (a `block`, or the `blocks` of its relation: the draft a grant bound to a reference returns, bogd3v/micelio#977) is left out, so it is never read again.
 */
export function reusableTargetIds(sections: readonly unknown[]): string[] {
  return [...new Set(sections.map(unresolvedTarget).filter((id): id is string => id !== undefined))]
}

/**
 * Reads the published reusable blocks of a page with one filtered `GET /api/reusable-blocks` (ADR 0022, section 1): `filters[documentId][$in]` of `documentIds`, a page size of their count, the page's locale and Strapi's default status, the published one.
 *
 * @param event - The visitor's request, so the CMS rate-limits per visitor; none for the cached page (`loadPage`) and the static build.
 * @returns The entries by document id. Nothing is asked for no document id. A failed read is logged as `cms.reusable-blocks` and gives no entry, so the page still answers, as a failed post list does.
 */
export async function readReusableTargets(documentIds: readonly string[], locale: string | undefined, event?: H3Event): Promise<ReusableTargetEntries> {
  const entries = new Map<string, unknown>()
  if (documentIds.length === 0) return entries
  const query = qs.stringify({
    filters: { documentId: { $in: documentIds } },
    locale,
    pagination: { page: 1, pageSize: documentIds.length },
    populate: REUSABLE_BLOCK_POPULATE,
  }, { skipNulls: true })
  try {
    const response = await strapiFetch<{ data?: unknown }>(`/api/reusable-blocks?${query}`, event ? { event } : {})
    for (const entry of Array.isArray(response.data) ? response.data : []) {
      const documentId = (entry as { documentId?: unknown } | null)?.documentId
      if (typeof documentId === 'string' && documentIds.includes(documentId)) entries.set(documentId, entry)
    }
  } catch (error: unknown) {
    logError('cms.reusable-blocks', 'Fetching the reusable blocks of a page failed', { error, ...(event && { event }) })
  }
  return entries
}

/**
 * Sets the `block` of each reference of `sections` that has none from the entry of its target, parsed with `parseReusableTarget`.
 *
 * @remarks
 * A reference whose target has no entry (unpublished, missing in the locale, of another site, or a failed read) or no valid block keeps none, and the page draws nothing in its place.
 */
export function withReusableTargets<T extends { __component: string }>(sections: T[], entries: ReusableTargetEntries, context: PageContext): T[] {
  return sections.map((section) => {
    const documentId = unresolvedTarget(section)
    const block = documentId === undefined ? null : parseReusableTarget(entries.get(documentId), context)
    return block ? { ...section, block } : section
  })
}

/**
 * Reads the published targets of the references of `sections` that carry no `block`, in the page's locale, and sets each one's `block`: `readReusableTargets`, then `withReusableTargets`.
 *
 * @param event - As for `readReusableTargets`.
 */
export async function resolveReusableTargets<T extends { __component: string }>(sections: T[], locale: string | undefined, context: PageContext, event?: H3Event): Promise<T[]> {
  const ids = reusableTargetIds(sections)
  if (ids.length === 0) return sections
  return withReusableTargets(sections, await readReusableTargets(ids, locale, event), context)
}
