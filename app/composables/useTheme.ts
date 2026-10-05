import type { ComputedRef } from 'vue'
import { modes } from '#micelio/theme'
import type { ThemeMode, ThemeModeDefinition } from '~/interfaces'
import { nextMode, schemeOf, storeMode } from '~/helpers/theme'

export interface UseTheme {
  modes: ThemeModeDefinition[]
  theme: ComputedRef<ThemeMode>
  nextTheme: ComputedRef<ThemeMode>
  isDark: ComputedRef<boolean>
  setTheme: (next: ThemeMode, origin?: EventTarget | null) => void
  toggle: (origin?: EventTarget | null) => void
  sync: (next: ThemeMode) => void
}

export function useTheme(): UseTheme {
  const state = useState<ThemeMode>('bd-theme', () => modes[0]?.id ?? '')

  const theme = computed<ThemeMode>(() => state.value)
  const nextTheme = computed<ThemeMode>(() => nextMode(modes, state.value))
  const isDark = computed<boolean>(() => schemeOf(modes, state.value) === 'dark')

  function sync(next: ThemeMode): void {
    const root = document.documentElement
    root.setAttribute('data-theme', next)
    root.setAttribute('data-scheme', schemeOf(modes, next))
    state.value = next
  }

  function setTheme(next: ThemeMode, origin?: EventTarget | null): void {
    if (import.meta.server) return
    storeMode(next)

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
    setTheme(nextTheme.value, origin)
  }

  return { modes, theme, nextTheme, isDark, setTheme, toggle, sync }
}
