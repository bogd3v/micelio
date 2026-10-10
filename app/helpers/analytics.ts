/** The tracker of the Umami analytics script, as the page exposes it on `window.umami`. */
export interface UmamiTracker {
  track: (event: string, data?: Record<string, string>) => void
}

interface UmamiScriptConfig {
  websiteId: string
  scriptPath: string
  siteUrl: string
}

type UmamiScriptAttributes = {
  'src': string
  'defer': boolean
  'data-website-id': string
  'data-domains': string
}

/** The name of the Umami event sent when a reader follows a link that leaves the site. */
export const OUTBOUND_LINK_EVENT = 'outbound-link'

/**
 * The attributes of the Umami script tag, or null when there is no website id or the site URL is not a valid URL.
 *
 * @remarks
 * `data-domains` is the hostname of the site URL.
 */
export function umamiScriptAttributes(config: UmamiScriptConfig): UmamiScriptAttributes | null {
  if (!config.websiteId || !URL.canParse(config.siteUrl)) return null
  return {
    'src': config.scriptPath,
    'defer': true,
    'data-website-id': config.websiteId,
    'data-domains': new URL(config.siteUrl).hostname,
  }
}

/** Whether a request path, without its query string, is the proxied Umami script or its collect endpoint. */
export function isUmamiProxyPath(path: string, scriptPath: string, collectPath: string): boolean {
  const pathname = path.split('?')[0]
  return pathname === scriptPath || pathname === collectPath
}

/**
 * The absolute URL of a link that leads away from the site, or null for a link on the same origin, a link that is not http or https, and a link that does not parse.
 *
 * @param href - The link as written in the page, relative or absolute.
 * @param origin - The origin of the page, used to resolve relative links.
 */
export function outboundLinkUrl(href: string, origin: string): string | null {
  let url: URL
  try {
    url = new URL(href, origin)
  } catch {
    return null
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
  return url.origin === new URL(origin).origin ? null : url.href
}
