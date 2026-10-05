import type { ComputedRef } from 'vue'
import type { NavLink } from '~/interfaces'

/** The main navigation links, shared by the header variants. */
export function useNavLinks(): ComputedRef<NavLink[]> {
  const { t } = useI18n()
  const { localizePath } = useLocaleUtils()
  return computed<NavLink[]>(() => [
    { id: 'home', label: t('nav.home'), to: localizePath('/') },
    { id: 'blog', label: t('nav.blog'), to: localizePath('/blog') },
    { id: 'about', label: t('nav.about'), to: localizePath('/about') },
  ])
}
