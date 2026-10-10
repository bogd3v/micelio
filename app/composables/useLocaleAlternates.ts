import type { LocaleAlternates, LocalePaths } from '~/interfaces'

interface LocaleAlternatesState {
  alternates: Ref<LocaleAlternates | null>
  setAlternates: (paths: LocalePaths, options?: { hreflang?: boolean }) => void
}

export function useLocaleAlternates(): LocaleAlternatesState {
  const route = useRoute()
  const alternates = useState<LocaleAlternates | null>('locale-alternates', () => null)

  function setAlternates(paths: LocalePaths, options: { hreflang?: boolean } = {}): void {
    alternates.value = { path: route.path, paths, ...(options.hreflang === false ? { hreflang: false } : {}) }
  }

  return { alternates, setAlternates }
}
