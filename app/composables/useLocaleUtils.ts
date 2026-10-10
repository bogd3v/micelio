import { defaultLocale, Locale, type LocalePaths, type LocaleSwitchTarget } from '~/interfaces'
import { localeSwitchQuery, localizedPath } from '~/helpers/locale'

/**
 * Returns the helpers that build paths in the current or another locale.
 *
 * @remarks
 * The default locale has no URL prefix; every other locale is prefixed with its code. `localePaths` is the current page in each locale: the alternates of `useLocaleAlternates` when the page has set them for this route, otherwise the path computed from the route. `switchLocale` gives the target of the language switch, keeping the query and the hash, and falls back to the blog list when a locale has no path. Call it in setup, because it reads `useI18n`, `useRoute` and `useLocaleAlternates`.
 */
export function useLocaleUtils() {
  const { locale, locales } = useI18n()
  const route = useRoute()
  const { alternates } = useLocaleAlternates()

  function getLocalePrefix(localeCode?: string | Locale): string {
    const l = localeCode || locale.value
    if (l === defaultLocale) return ''
    return `/${l}`
  }

  function localizePath(path: string, localeCode?: string | Locale): string {
    const prefix = getLocalePrefix(localeCode)
    if (!path || path === '/') {
      return prefix || '/'
    }
    return `${prefix}${path.startsWith('/') ? path : `/${path}`}`
  }

  function getLocalizedPaths(basePath: string): Record<string, string> {
    const allLocales = (locales.value as Array<{ code: string }>).map(
      l => l.code,
    )
    const paths: Record<string, string> = {}

    for (const l of allLocales) {
      paths[l] = localizePath(basePath, l)
    }

    return paths
  }

  const localePaths = computed<LocalePaths>(() => {
    if (alternates.value?.path === route.path) return alternates.value.paths
    const currentLocale = locale.value as Locale
    const basePath = currentLocale === defaultLocale
      ? route.path
      : route.path.replace(new RegExp(`^/${currentLocale}(?=/|$)`), '') || '/'
    const paths: LocalePaths = {}
    for (const code of Object.values(Locale)) {
      paths[code] = localizedPath(basePath, code)
    }
    return paths
  })

  function switchLocale(newLocale: Locale): LocaleSwitchTarget {
    const path = localePaths.value[newLocale] ?? localizedPath('/blog', newLocale)
    return { path, query: localeSwitchQuery(route.query), hash: route.hash }
  }

  const isDefaultLocale = computed(() => locale.value === defaultLocale)

  const currentLocalePath = computed(() => localizePath('/'))

  return {
    getLocalePrefix,
    localizePath,
    getLocalizedPaths,
    localePaths,
    switchLocale,
    isDefaultLocale,
    currentLocalePath,
  }
}
