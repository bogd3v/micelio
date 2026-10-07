import type { ComputedRef } from 'vue'
import { loadReadIds, saveReadIds, withReadId } from '~/helpers/readArticles'

interface ReadArticles {
  count: ComputedRef<number>
  isRead: (documentId: string | null | undefined) => boolean
  markRead: (documentId: string) => void
  clear: () => void
}

export function useReadArticles(): ReadArticles {
  const { isStatic } = useStaticSite()
  const ids = useState<string[]>('bd-read-articles', () => [])
  const loaded = useState<boolean>('bd-read-articles-loaded', () => false)

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
