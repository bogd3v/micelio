import { assets } from '#micelio/display-fonts'
import { specimen } from '#micelio/specimen'
import { MODES_ATTRIBUTE } from '../../modules/theme/init-script.mjs'
import { Locale, defaultLocale } from '~/interfaces/locale'
import { displayFontOverride, insertThemeLinks, themePreloadLinks } from '../utils/displayFonts'
import { overridesFor } from '../lib/themeSwitch/request'
import { activeTheme } from '../utils/activeTheme'
import { themeOverridesCss } from '../utils/theme'

/** The locale of the page from its path prefix (`/es/...`); the default one otherwise. */
function pathLocale(path: string): Locale {
  const first = path.split(/[/?#]/)[1]
  return Object.values(Locale).find(locale => locale === first && locale !== defaultLocale) ?? defaultLocale
}

// Not useHead: unhead would own data-theme and reset the init script's choice on hydration
export default defineNitroPlugin((nitroApp) => {
  // contentSecurityPolicy.ts runs first (alphabetical) and hashes scripts only: anything pushed here must be a
  // style, which style-src 'unsafe-inline' allows. A script would be blocked.
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    // The theme this request began with, not the one active now: a page never mixes two themes
    const { digest, modes, fonts, display: themeDisplay, layout } = (event.context.activeTheme ?? activeTheme()).runtime
    const first = modes[0]
    if (!first) return
    // Strapi down or slow: the theme's own first mode and colors, as before
    let loaded: Awaited<ReturnType<typeof loadSiteCached>> | undefined
    try {
      loaded = await loadSiteCached(pathLocale(event.path))
    } catch {
      loaded = undefined
    }
    // Overrides resolved against another theme (a switch happened while this page rendered) are left out
    const theme = overridesFor(loaded, digest)
    const chosen = modes.find(mode => mode.id === theme?.defaultMode)
    const initial = chosen ?? first
    // data-mode-default is read by the init script (modules/theme/init-script.mjs); the visitor's stored choice still wins
    const list = modes.map(mode => `${mode.id}:${mode.scheme}`).join(',')
    // Only the specimen bundles a second header's CSS; elsewhere the theme's stylesheet holds one, so no bytes are spent
    const header = specimen ? ` data-layout-header="${layout.header}"` : ''
    html.htmlAttrs.push(`data-theme="${initial.id}" data-scheme="${initial.scheme}"${chosen ? ` data-mode-default="${chosen.id}"` : ''} ${MODES_ATTRIBUTE}="${list}"${header}`)
    const font = displayFontOverride(theme?.displayFont, themeDisplay, assets)
    const css = [themeOverridesCss(theme, modes.map(mode => mode.id)), font?.css].filter(Boolean).join('')
    html.head = insertThemeLinks(html.head, digest, themePreloadLinks(fonts, themeDisplay, Boolean(font)))
    if (font) html.head.push(`<link rel="preload" as="font" type="font/woff2" href="${font.href}" crossorigin>`)
    if (css) html.head.push(`<style id="theme-overrides">${css}</style>`)
  })
})
