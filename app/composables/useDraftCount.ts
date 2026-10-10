import type { DraftListResponse } from '~/interfaces'

interface UseDraftCount {
  count: Ref<number | null>
  refresh: () => Promise<void>
}

/**
 * Holds the number of drafts the signed-in editor can see.
 *
 * @remarks
 * `count` is shared state (`draft-count`) and is `null` until a refresh succeeds. `refresh` reads `/api/drafts` and sets `count` to the total of the response; any failure sets it back to `null`, without throwing. The list is read only when the caller calls `refresh`, for example the drafts plugin for editors. Call it in setup or a plugin, because it uses `useState`.
 */
export function useDraftCount(): UseDraftCount {
  const count = useState<number | null>('draft-count', () => null)

  async function refresh(): Promise<void> {
    try {
      const response = await $fetch<DraftListResponse>('/api/drafts')
      count.value = response.meta.count
    } catch {
      count.value = null
    }
  }

  return { count, refresh }
}
