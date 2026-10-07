import { assets, themeDisplay } from '#micelio/display-fonts'
import { fonts, modes } from '#micelio/theme'
import { Locale, defaultLocale } from '~/interfaces/locale'
import { displayFontOverride, insertAfterStylesheet, themePreloadLinks } from '../utils/displayFonts'
import { themeOverridesCss } from '../utils/theme'

/** The locale of the page from its path prefix (`/es/...`); the default one otherwise. */
function pathLocale(path: string): Locale {
  const first = path.split(/[/?#]/)[1]
  return Object.values(Locale).find(locale => locale === first && locale !== defaultLocale) ?? defaultLocale
}

// Not useHead: unhead would own data-theme and reset the init script's choice on hydration
export default defineNitroPlugin((nitroApp) => {
  const first = modes[0]
  if (!first) return
  // contentSecurityPolicy.ts runs first (alphabetical) and hashes scripts only: anything pushed here must be a
  // style, which style-src 'unsafe-inline' allows. A script would be blocked.
  nitroApp.hooks.hook('render:html', async (html, { event }) => {
    // Strapi down or slow: the theme's own first mode and colors, as before
    const { site } = await loadSiteCached(pathLocale(event.path)).catch(() => ({ site: undefined }))
    const theme = site?.theme
    const chosen = modes.find(mode => mode.id === theme?.defaultMode)
    const initial = chosen ?? first
    // data-mode-default is read by the init script (modules/theme/init-script.mjs); the visitor's stored choice still wins
    html.htmlAttrs.push(`data-theme="${initial.id}" data-scheme="${initial.scheme}"${chosen ? ` data-mode-default="${chosen.id}"` : ''}`)
    const font = displayFontOverride(theme?.displayFont, themeDisplay, assets)
    const css = [themeOverridesCss(theme, modes.map(mode => mode.id)), font?.css].filter(Boolean).join('')
    html.head = insertAfterStylesheet(html.head, themePreloadLinks(fonts, themeDisplay, Boolean(font)))
    if (font) html.head.push(`<link rel="preload" as="font" type="font/woff2" href="${font.href}" crossorigin>`)
    if (css) html.head.push(`<style id="theme-overrides">${css}</style>`)
  })
})
