import type { ComputedRef } from 'vue'
import type { ThemeMode } from '~/interfaces'
import { storeTheme } from '~/helpers/theme'

export interface UseTheme {
  theme: ComputedRef<ThemeMode>
  isDark: ComputedRef<boolean>
  setTheme: (next: ThemeMode, origin?: EventTarget | null) => void
  toggle: (origin?: EventTarget | null) => void
  sync: (next: ThemeMode) => void
}

export function useTheme(): UseTheme {
  const state = useState<ThemeMode>('bd-theme', () => 'noche')

  const theme = computed<ThemeMode>(() => state.value)
  const isDark = computed<boolean>(() => state.value === 'noche')

  function sync(next: ThemeMode): void {
    document.documentElement.setAttribute('data-theme', next)
    state.value = next
  }

  function setTheme(next: ThemeMode, origin?: EventTarget | null): void {
    if (import.meta.server) return
    storeTheme(next)

    const root = document.documentElement
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!document.startViewTransition || reduceMotion) {
      sync(next)
      return
    }

    if (origin instanceof Element) {
      const rect = origin.getBoundingClientRect()
      root.style.setProperty('--vt-x', `${rect.left + rect.width / 2}px`)
      root.style.setProperty('--vt-y', `${rect.top + rect.height / 2}px`)
    }

    root.classList.add('bd-vt-theme')
    const transition = document.startViewTransition(() => sync(next))
    transition.finished.finally(() => root.classList.remove('bd-vt-theme'))
  }

  function toggle(origin?: EventTarget | null): void {
    setTheme(isDark.value ? 'dia' : 'noche', origin)
  }

  return { theme, isDark, setTheme, toggle, sync }
}
