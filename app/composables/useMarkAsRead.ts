import type { Ref } from 'vue'
import { READ_THRESHOLD, readRatio } from '~/helpers/readArticles'

/**
 * Marks an article as read once enough of its element is visible in the window.
 *
 * @remarks
 * On mount it listens to scroll and resize on the window and checks the `target` element on each change of `documentId`, at most once per animation frame. Nothing happens while `target` or `documentId` is empty, or when the article is already read. The listeners are removed before the component unmounts. Call it in setup, because it registers lifecycle hooks and uses `useReadArticles`.
 */
export function useMarkAsRead(target: Ref<HTMLElement | null>, documentId: Ref<string | undefined>): void {
  const { isRead, markRead } = useReadArticles()
  let frame: number | null = null

  function check(): void {
    frame = null
    const id = documentId.value
    const element = target.value
    if (!id || !element || isRead(id)) return
    const rect = element.getBoundingClientRect()
    if (readRatio(rect.top, rect.height, window.innerHeight) >= READ_THRESHOLD) markRead(id)
  }

  function onScroll(): void {
    if (frame !== null) return
    frame = requestAnimationFrame(check)
  }

  onMounted(() => {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    watch(documentId, onScroll, { immediate: true })
  })

  onBeforeUnmount(() => {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    if (frame !== null) cancelAnimationFrame(frame)
  })
}
