import { SITE_MODULES } from '../interfaces/site'
import type { SiteModule, SiteModules } from '../interfaces/site'
import { isStaticMode } from './siteMode'
import type { SiteMode } from './siteMode'

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
  /** An external newsletter form provider is configured (static modes) */
  formAction: boolean
}

/** The modules that actually work: Strapi's switches, minus those the mode, the configuration or another module rule out (ADR 0006, section 2). */
export function effectiveModules(modules: SiteModules, requirements: ModuleRequirements, mode: SiteMode = 'dynamic'): SiteModules {
  if (isStaticMode(mode)) {
    // No server: sessions, writes and the fediverse actor are out; the newsletter needs an external form
    return {
      ...modules,
      newsletter: modules.newsletter && requirements.formAction,
      comments: false,
      accounts: false,
      drafts: false,
      fediverse: false,
    }
  }
  return {
    ...modules,
    newsletter: modules.newsletter && requirements.smtp,
    fediverse: modules.fediverse && requirements.fediverse,
    // Editors sign in to see drafts
    drafts: modules.drafts && modules.accounts,
  }
}

/** The modules before /api/site answers (or if it fails): all on, within what the mode allows. SMTP and the fediverse count as available. */
export function fallbackModules(modules: SiteModules, mode: SiteMode, newsletterFormAction: unknown): SiteModules {
  const formAction = typeof newsletterFormAction === 'string' && newsletterFormAction !== ''
  return effectiveModules(modules, { smtp: true, fediverse: true, formAction }, mode)
}
