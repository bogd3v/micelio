import { addTemplate } from 'nuxt/kit'
import type { CssSource, ThemeContext, LayoutRegion } from './types'

/** Template of each region's CSS; main.css imports it where the core file it replaces sits. */
const REGION_TEMPLATES: Record<LayoutRegion, string> = {
  header: 'micelio/layout-header.css',
  footer: 'micelio/layout-footer.css',
  home: 'micelio/pages-home.css',
  postList: 'micelio/pages-post-list.css',
  article: 'micelio/pages-article.css',
}

function joinCss(sources: CssSource[]): string {
  return sources.map(source => source()).filter(Boolean).join('\n')
}

// main.css imports these at fixed positions (ADR 0005, section 3); never nuxt.options.css
/**
 * Adds the templates that carry the active theme's region CSS into the build, under `micelio/`.
 *
 * @remarks
 * Runs at build time. The five region templates are empty in a plain build: the CSS of the variants a theme chose travels in the
 * theme's stylesheet (`install/compile.ts`, ADR 0009 section 6), and only the specimen puts every variant's CSS here. The theme's
 * own stylesheet (roles, fonts, `theme.css`, slot styles and the mode switch's rules) and `sections.css` are no longer in the
 * bundle: the store compiles them (`install/compile.ts`) and `server/plugins/themeMode.ts` links them (ADR 0009, section 6).
 * Each template is generated again on every regeneration.
 */
export function setupCss(ctx: ThemeContext): void {
  for (const [region, filename] of Object.entries(REGION_TEMPLATES) as Array<[LayoutRegion, string]>) {
    addTemplate({
      filename,
      write: true,
      getContents: () => joinCss(ctx.layoutCss[region]),
    })
  }
}
