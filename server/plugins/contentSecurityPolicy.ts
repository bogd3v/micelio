import { createHash } from 'node:crypto'
import { contentSecurityPolicy, inlineScripts, islandPolicyOptions, islandsInHtml } from '~/helpers/securityHeaders'
import { HEAVY_ISLANDS } from '~/islands/heavy'

function sha256(content: string): string {
  return createHash('sha256').update(content).digest('base64')
}

export default defineNitroPlugin((nitroApp) => {
  if (import.meta.dev) return
  nitroApp.hooks.hook('render:html', (html, { event }) => {
    const config = useRuntimeConfig(event)
    const document = [...html.head, ...html.bodyPrepend, ...html.body, ...html.bodyAppend].join('')
    setResponseHeader(event, 'content-security-policy', contentSecurityPolicy({
      scriptHashes: inlineScripts(document).map(sha256),
      imageOrigins: [config.public.strapiUrl, config.mediaUrl],
      // Only the pages that render a heavy island get what it needs (ADR 0004, ADR 0006 section 6)
      ...islandPolicyOptions(islandsInHtml(document, HEAVY_ISLANDS)),
    }))
  })
})
