import type { ComputedRef } from 'vue'
import type { Page, PageSection, Site, SiteNavLink } from '~/interfaces'
import { knownSections } from '~/helpers/pages'
import { landingLinks } from '~/helpers/landing'

/** The main navigation links, shared by the header variants. */
export function useNavLinks(): ComputedRef<SiteNavLink[]> {
  const { t } = useI18n()
  const { localizePath } = useLocaleUtils()
  const { isLanding, blogEnabled } = useStaticSite()
  // __STATIC_BUILD__ folds away in a dynamic build, which then ships none of the landing code (docs/performance.md)
  const landing = __STATIC_BUILD__ && isLanding ? useLandingNav() : undefined
  return computed<SiteNavLink[]>(() => {
    const home: SiteNavLink = { id: 'home', label: t('nav.home'), to: localizePath('/') }
    const blog: SiteNavLink = { id: 'blog', label: t('nav.blog'), to: localizePath('/blog') }
    // A landing has no standing about page to link: its sections and their links stand in (ADR 0006, section 1)
    if (landing) return landing.value.length ? [...landing.value, ...(blogEnabled ? [blog] : [])] : [home, ...(blogEnabled ? [blog] : [])]
    return [home, blog, { id: 'about', label: t('nav.about'), to: localizePath('/about') }]
  })
}

/**
 * The landing navigation (docs/static-mode.md, "Landing"): anchors to the titled sections of the home page, then the links of its hero and call to action.
 * Empty when no home page is set or it cannot be loaded. The header renders before the page, when the site settings have not answered yet,
 * so this asks for them itself (the same key everywhere it is used: one request).
 */
function useLandingNav(): ComputedRef<SiteNavLink[]> {
  const { locale } = useI18n()
  const { localizePath, getLocalePrefix } = useLocaleUtils()
  const { blogEnabled } = useStaticSite()
  const newsletterOn = useModule('newsletter')
  const { data } = useAsyncData<PageSection[]>(`landing-nav-${locale.value}`, async () => {
    const site = await $fetch<Site>('/api/site', { query: { locale: locale.value } })
    const slug = site.homePage?.slug
    if (!slug) return []
    const page = await $fetch<Page>(`/api/pages/${encodeURIComponent(slug)}`, { query: { locale: locale.value } })
    return knownSections(page.sections)
  }, { default: () => [] })
  return computed<SiteNavLink[]>(() => landingLinks(
    data.value,
    localizePath('/'),
    { newsletterOn: newsletterOn.value, blogEnabled },
    { prefix: getLocalePrefix(), localize: localizePath },
  ))
}
