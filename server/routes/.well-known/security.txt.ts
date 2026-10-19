import { defaultLocale, Locale } from '~/interfaces/locale'
import { securityTxt } from '~/helpers/securityTxt'

// The site settings are cached (`siteCacheSeconds`), so a scanner asking for a missing file costs no CMS call.
// An hour at most: `Expires` is the render date plus 180 days, so a cache never serves a date far behind
const CACHE_CONTROL = 'public, max-age=3600'

/** `security.txt` (RFC 9116) from the `securityContact` of the site settings; an empty 404 when the site has none. */
export default defineEventHandler(async (event) => {
  const { securityContact } = await loadSiteCached(defaultLocale)
  const body = securityTxt(securityContact, useRuntimeConfig().public.siteUrl, Object.values(Locale))
  if (body === null) {
    setResponseStatus(event, 404)
    setHeader(event, 'Cache-Control', 'no-cache')
    return ''
  }
  setHeader(event, 'Content-Type', 'text/plain; charset=utf-8')
  setHeader(event, 'Cache-Control', CACHE_CONTROL)
  return body
})
