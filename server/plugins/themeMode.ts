import { modes } from '#micelio/theme'

// Not useHead: unhead would own data-theme and reset the init script's choice on hydration
export default defineNitroPlugin((nitroApp) => {
  const first = modes[0]
  if (!first) return
  nitroApp.hooks.hook('render:html', (html) => {
    html.htmlAttrs.push(`data-theme="${first.id}" data-scheme="${first.scheme}"`)
  })
})
