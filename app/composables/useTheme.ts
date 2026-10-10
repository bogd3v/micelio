import type { ComputedRef } from 'vue'
import { modes } from '#micelio/theme'
import type { ThemeMode, ThemeModeDefinition } from '~/interfaces'
import { nextMode, schemeOf, storeMode } from '~/helpers/theme'

interface UseTheme {
  modes: ThemeModeDefinition[]
  theme: ComputedRef<ThemeMode>
  nextTheme: ComputedRef<ThemeMode>
  isDark: ComputedRef<boolean>
  setTheme: (next: ThemeMode, origin?: EventTarget | null) => void
  toggle: (origin?: EventTarget | null) => void
  sync: (next: ThemeMode) => void
  /** theme.modes.<id> from the messages, else the mode's name, else its id. */
  modeLabel: (id: ThemeMode) => string
}

/**
 * Holds the active color mode of the site and changes it, with a view transition when the browser allows it.
 *
 * @remarks
 * The mode is shared state (`myc-theme`) that starts at the first mode of the theme. `setTheme` does nothing on the server; on the client it saves the choice and sets the `data-theme` and `data-scheme` attributes on the root element. With `prefers-reduced-motion` or without `document.startViewTransition` the change is immediate; otherwise it runs as a view transition, from the center of `origin` when it is an element, and the `myc-vt-theme` class is removed when the transition ends. `sync` applies a mode to the page and the state without saving it. Call it in setup or a plugin, because it reads `useNuxtApp`.
 */
export function useTheme(): UseTheme {
  const { t, te } = useNuxtApp().$i18n
  const state = useState<ThemeMode>('myc-theme', () => modes[0]?.id ?? '')

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

    root.classList.add('myc-vt-theme')
    const transition = document.startViewTransition(() => sync(next))
    void clearWhenFinished(transition, root)
  }

  async function clearWhenFinished(transition: ViewTransition, root: HTMLElement): Promise<void> {
    try {
      await transition.finished
    } catch {
      // The update failed: still remove the class
    } finally {
      root.classList.remove('myc-vt-theme')
    }
  }

  function modeLabel(id: ThemeMode): string {
    const key = `theme.modes.${id}`
    return te(key) ? t(key) : (modes.find(mode => mode.id === id)?.name ?? id)
  }

  function toggle(origin?: EventTarget | null): void {
    setTheme(nextTheme.value, origin)
  }

  return { modes, theme, nextTheme, isDark, setTheme, toggle, sync, modeLabel }
}
