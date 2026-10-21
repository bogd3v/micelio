import { servedTheme } from '../../utils/activeTheme'
import { isEntryDigest, themeAsset } from '../../lib/themeAssets'

// The files of a compiled theme, from the verified bytes in memory (ADR 0009, section 8). A catch-all, so every shape under /_t/
// (no digest, a digest alone, an unknown digest, a digest this site does not serve, an unknown file) gets the same empty 404.
export default defineEventHandler((event) => {
  const rest = getRouterParam(event, 'rest') ?? ''
  const slash = rest.indexOf('/')
  const digest = slash === -1 ? rest : rest.slice(0, slash)
  const asset = slash !== -1 && isEntryDigest(digest) ? themeAsset(servedTheme(digest)?.entry, rest.slice(slash + 1), getRequestHeader(event, 'accept-encoding')) : null
  if (asset === null) {
    setResponseStatus(event, 404)
    return ''
  }
  setResponseHeaders(event, asset.headers)
  return asset.body
})
