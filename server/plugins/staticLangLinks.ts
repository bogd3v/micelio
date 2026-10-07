import { alternatePaths, rewriteLangLinks } from '~/helpers/langLinks'
import { isStaticMode, parseSiteMode } from '~/helpers/siteMode'

// Static pages run no Vue: the language links take their href from the head's hreflang links (app/helpers/langLinks.ts)
export default defineNitroPlugin((nitroApp) => {
  if (!isStaticMode(parseSiteMode(useRuntimeConfig().public.siteMode))) return
  nitroApp.hooks.hook('render:html', (html) => {
    const paths = alternatePaths(html.head.join(''))
    for (const part of ['bodyPrepend', 'body', 'bodyAppend'] as const) {
      html[part] = html[part].map(chunk => rewriteLangLinks(chunk, paths))
    }
  })
})
