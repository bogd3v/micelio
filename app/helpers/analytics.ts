export interface UmamiTracker {
  track: (event: string, data?: Record<string, string>) => void
}

export interface UmamiScriptConfig {
  websiteId: string
  scriptPath: string
  siteUrl: string
}

export type UmamiScriptAttributes = {
  'src': string
  'defer': boolean
  'data-website-id': string
  'data-domains': string
}

export const OUTBOUND_LINK_EVENT = 'outbound-link'

export function umamiScriptAttributes(config: UmamiScriptConfig): UmamiScriptAttributes | null {
  if (!config.websiteId || !URL.canParse(config.siteUrl)) return null
  return {
    'src': config.scriptPath,
    'defer': true,
    'data-website-id': config.websiteId,
    'data-domains': new URL(config.siteUrl).hostname,
  }
}

export function isUmamiProxyPath(path: string, scriptPath: string, collectPath: string): boolean {
  const pathname = path.split('?')[0]
  return pathname === scriptPath || pathname === collectPath
}

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
