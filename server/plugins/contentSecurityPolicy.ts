import { createHash } from 'node:crypto'
import { contentSecurityPolicy, inlineScripts, islandPolicyOptions, islandsInHtml, sceneModelOrigins } from '~/helpers/securityHeaders'
import { HEAVY_ISLANDS } from '~/islands/lib/constants'

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('base64')
}

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const config = useRuntimeConfig(event)
    const document = [...html.head, ...html.bodyPrepend, ...html.body, ...html.bodyAppend].join('')
    const mediaOrigins = [config.public.strapiUrl, config.mediaUrl]
    const islands = islandPolicyOptions(islandsInHtml(document, HEAVY_ISLANDS))
    setResponseHeader(event, 'content-security-policy', contentSecurityPolicy({
      scriptHashes: inlineScripts(document).map(sha256),
      imageOrigins: mediaOrigins,
      // Only the pages that render a heavy island get what it needs (ADR 0004, ADR 0006 section 6)
      ...islands,
      // A scene fetches its model from its media origin: that page, and only that origin (ADR 0004, amendment of #246)
      connectSources: [...islands.connectSources ?? [], ...sceneModelOrigins(document, mediaOrigins)],
    }))
  })
})
