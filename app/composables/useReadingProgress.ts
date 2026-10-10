import type { Ref } from 'vue'
import { readingPercent } from '~/helpers/header'

/**
 * Returns the scroll progress of the page, from 0 to 100, updated while `enabled` is true.
 *
 * @remarks
 * While enabled, it listens to scroll and resize on the window and measures at most once per animation frame. When `enabled` turns false it removes the listeners and resets the value to 0. Nothing runs on the server, because the listeners start on mount. Call it in setup, because it registers lifecycle hooks.
 */
export function useReadingProgress(enabled: Ref<boolean>): Ref<number> {
  const progress = ref(0)
  let frame: number | null = null

  function measure(): void {
    frame = null
    const root = document.documentElement
    progress.value = readingPercent(window.scrollY, root.scrollHeight, window.innerHeight)
  }

  function onScroll(): void {
    if (frame !== null) return
    frame = requestAnimationFrame(measure)
  }

  function start(): void {
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    measure()
  }

  function stop(): void {
    window.removeEventListener('scroll', onScroll)
    window.removeEventListener('resize', onScroll)
    if (frame !== null) cancelAnimationFrame(frame)
    frame = null
    progress.value = 0
  }

  onMounted(() => {
    watch(enabled, on => (on ? start() : stop()), { immediate: true })
  })

  onBeforeUnmount(stop)

  return progress
}
