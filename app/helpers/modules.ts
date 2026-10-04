import { SITE_MODULES } from '../interfaces/site'
import type { SiteModule, SiteModules } from '../interfaces/site'

/** Path prefixes that belong to each module: API routes and pages (with or without a locale prefix). */
export const MODULE_PATHS: Readonly<Record<SiteModule, readonly string[]>> = {
  newsletter: ['/api/newsletter', '/confirm', '/newsletter'],
  comments: ['/api/comments'],
  accounts: ['/api/auth', '/account'],
  drafts: ['/api/drafts', '/drafts'],
  fediverse: ['/api/fediverse'],
  search: ['/api/search'],
  support: [],
}

const LOCALE_PREFIX = /^\/es(?=\/|$)/

function matches(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}/`)
}

/** The module a request path belongs to, or null when every site has it. */
export function moduleForPath(path: string): SiteModule | null {
  const pathname = (path.split(/[?#]/)[0] ?? '').replace(LOCALE_PREFIX, '') || '/'
  for (const module of SITE_MODULES) {
    if (MODULE_PATHS[module].some(prefix => matches(pathname, prefix))) return module
  }
  return null
}

export function isModuleEnabled(modules: SiteModules, module: SiteModule): boolean {
  return modules[module]
}

/** What the server has configured; a module that needs something missing turns itself off. */
export interface ModuleRequirements {
  smtp: boolean
  fediverse: boolean
}

/** The modules that actually work: Strapi's switches, minus those missing their configuration or a module they need. */
export function effectiveModules(modules: SiteModules, requirements: ModuleRequirements): SiteModules {
  return {
    ...modules,
    newsletter: modules.newsletter && requirements.smtp,
    fediverse: modules.fediverse && requirements.fediverse,
    // Editors sign in to see drafts
    drafts: modules.drafts && modules.accounts,
  }
}
