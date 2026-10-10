import type { ComputedRef } from 'vue'
import { loadReadIds, saveReadIds, withReadId } from '~/helpers/readArticles'

interface ReadArticles {
  count: ComputedRef<number>
  isRead: (documentId: string | null | undefined) => boolean
  markRead: (documentId: string) => void
  clear: () => void
}

/**
 * Holds the ids of the articles a visitor has read, kept in the browser.
 *
 * @remarks
 * The ids are shared state (`myc-read-articles`). They are loaded once from local storage under `READ_STORAGE_KEY`, on the first mount or `markRead`, and each change is written back there; `clear` empties both. Local storage exists only in the browser, so the list stays empty on the server. On static sites `isRead` is always false. Call it in setup, because it reads `useStaticSite` and registers a mount hook.
 */
export function useReadArticles(): ReadArticles {
  const { isStatic } = useStaticSite()
  const ids = useState<string[]>('myc-read-articles', () => [])
  const loaded = useState<boolean>('myc-read-articles-loaded', () => false)

  const count = computed<number>(() => ids.value.length)

  function isRead(documentId: string | null | undefined): boolean {
    // Static pages show no read marks: the history lives in the browser
    return !isStatic && Boolean(documentId) && ids.value.includes(documentId!)
  }

  function ensureLoaded(): void {
    if (loaded.value) return
    loaded.value = true
    ids.value = loadReadIds()
  }

  function markRead(documentId: string): void {
    ensureLoaded()
    const next = withReadId(ids.value, documentId)
    if (next === ids.value) return
    ids.value = next
    saveReadIds(next)
  }

  function clear(): void {
    ids.value = []
    saveReadIds([])
  }

  onMounted(ensureLoaded)

  return { count, isRead, markRead, clear }
}
