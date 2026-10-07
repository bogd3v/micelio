import { existsSync } from 'node:fs'
import { join } from 'node:path'
import { addTemplate } from 'nuxt/kit'
import { buildTokensCss } from './tokens.mjs'
import type { CssSource, ThemeContext } from './context'
import type { LayoutRegion } from './data'

/** Template of each region's CSS; main.css imports it where the core file it replaces sits. */
export const REGION_TEMPLATES: Record<LayoutRegion, string> = {
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
export function setupCss(ctx: ThemeContext): void {
  const { dir, load } = ctx

  addTemplate({
    filename: 'micelio/settings.css',
    write: true,
    getContents: () => [
      ...['fonts.css', 'font-fallbacks.css'].filter(file => existsSync(join(dir, file))).map(file => `@import "${join(dir, file)}";`),
      buildTokensCss(load().manifest),
    ].join('\n'),
  })
  addTemplate({
    filename: 'micelio/components.css',
    write: true,
    getContents: () => joinCss(ctx.componentsCss),
  })
  addTemplate({
    filename: 'micelio/theme.css',
    write: true,
    getContents: () => {
      const lines = [existsSync(join(dir, 'theme.css')) ? `@import "${join(dir, 'theme.css')}";` : '', joinCss(ctx.slotCss)].filter(Boolean)
      return lines.length ? `${lines.join('\n')}\n` : ''
    },
  })
  // Optional: the page sections' styling, imported by SectionRenderer so only pages with sections load it (ADR 0005, sections 4 and 11)
  addTemplate({
    filename: 'micelio/sections.css',
    write: true,
    getContents: () => (existsSync(join(dir, 'sections.css')) ? `@import "${join(dir, 'sections.css')}";\n` : ''),
  })
  for (const [region, filename] of Object.entries(REGION_TEMPLATES) as Array<[LayoutRegion, string]>) {
    addTemplate({
      filename,
      write: true,
      getContents: () => joinCss(ctx.layoutCss[region]),
    })
  }
}
