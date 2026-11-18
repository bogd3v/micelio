import type { IconRequest } from '~/interfaces/icons'
import { activeTheme } from '../utils/activeTheme'
import { iconSources, spriteFor } from '../utils/iconSprite'

// The sprite of the icons a page used (ADR 0021, section 3), inlined once at the start of the body. It is markup, not a script or a
// style: the CSP plugin (which runs first) is not touched. A page that used no icon is not touched either.
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    const used = event.context.iconSprite as Map<string, IconRequest> | undefined
    if (!used?.size) return
    // The theme this request began with, as themeMode.ts reads it
    const sprite = await spriteFor(used.values(), iconSources(event.context.activeTheme ?? activeTheme()))
    if (sprite) html.bodyPrepend.unshift(sprite)
  })
})
