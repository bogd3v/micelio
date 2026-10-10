import type { LocaleAlternates, LocalePaths } from '~/interfaces'

interface LocaleAlternatesState {
  alternates: Ref<LocaleAlternates | null>
  setAlternates: (paths: LocalePaths, options?: { hreflang?: boolean }) => void
}

/**
 * Holds the paths of the current page in each locale, for the hreflang links and the language switch.
 *
 * @remarks
 * The state is shared (`locale-alternates`) and is `null` until a page calls `setAlternates`. The app root reads it to render the `alternate` links, and `useLocaleUtils` reads it to build the paths. Call it in setup, because it reads `useRoute` and `useState`.
 */
export function useLocaleAlternates(): LocaleAlternatesState {
  const route = useRoute()
  const alternates = useState<LocaleAlternates | null>('locale-alternates', () => null)

  function setAlternates(paths: LocalePaths, options: { hreflang?: boolean } = {}): void {
    alternates.value = { path: route.path, paths, ...(options.hreflang === false ? { hreflang: false } : {}) }
  }

  return { alternates, setAlternates }
}
