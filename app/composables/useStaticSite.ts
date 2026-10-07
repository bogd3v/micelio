import { isStaticMode, parseSiteMode } from '~/helpers/siteMode'

export interface UseStaticSite {
  /** True in static and landing builds, where pages run no Vue (ADR 0006, section 3). */
  isStatic: boolean
  /** Id of the footer navigation that exists without JS, target of the menu link. */
  menuId: string
}

/** The one place that reads the site mode for UI that falls back to plain HTML. */
export function useStaticSite(): UseStaticSite {
  const isStatic = isStaticMode(parseSiteMode(useRuntimeConfig().public.siteMode))
  return { isStatic, menuId: 'bd-foot-nav' }
}
