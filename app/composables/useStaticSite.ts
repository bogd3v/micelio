import { isBlogEnabled, isStaticMode, parseSiteMode } from '~/helpers/siteMode'

export interface UseStaticSite {
  /** True in static and landing builds, where pages run no Vue (ADR 0006, section 3). */
  isStatic: boolean
  /** True in landing builds: the navigation comes from the home page's sections. */
  isLanding: boolean
  /** False when the build has no blog: a landing with no articles (modules/static-routes.ts decides it once, at build time). */
  blogEnabled: boolean
  /** Id of the footer navigation that exists without JS, target of the menu link. */
  menuId: string
}

/** The one place that reads the site mode for UI that falls back to plain HTML. */
export function useStaticSite(): UseStaticSite {
  const { siteMode, blogEnabled } = useRuntimeConfig().public
  const mode = parseSiteMode(siteMode)
  return { isStatic: isStaticMode(mode), isLanding: mode === 'landing', blogEnabled: isBlogEnabled(blogEnabled), menuId: 'bd-site-nav' }
}
