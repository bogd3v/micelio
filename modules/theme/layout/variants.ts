import { join } from 'node:path'
import type { ThemeContext } from '../context'
import type { LayoutRegion } from '../data'
import { LAYOUT_REGIONS } from '../data'

export interface RegionVariants {
  /** Name the component is registered under. */
  component: string
  /** Variants the core implements, by file name (the first is the default). */
  variants: string[]
}

// Components live in app/theme/layout/<region>/<Variant>.vue with <variant>.css beside them (ADR 0005, section 5)
export const REGION_VARIANTS: Record<LayoutRegion, RegionVariants> = {
  header: { component: 'RegionHeader', variants: ['bar'] },
  home: { component: 'RegionHome', variants: ['showcase'] },
  postList: { component: 'RegionPostList', variants: ['grid'] },
  article: { component: 'RegionArticle', variants: ['aside'] },
  footer: { component: 'RegionFooter', variants: ['columns'] },
}

/** Registers the component and CSS of the variant the theme uses in each region; the others are never bundled. */
export function registerVariants(ctx: ThemeContext, regions: readonly LayoutRegion[] = LAYOUT_REGIONS): void {
  const base = join(ctx.nuxt.options.srcDir, 'theme/layout')
  const { layout } = ctx.load().manifest
  for (const region of regions) {
    const { component, variants } = REGION_VARIANTS[region]
    const variant = layout?.[region] ?? variants[0]!
    const name = variant[0]!.toUpperCase() + variant.slice(1)
    ctx.components.push({ name: component, filePath: join(base, region, `${name}.vue`) })
    ctx.layoutCss[region].push(() => `@import "${join(base, region, `${variant}.css`)}";`)
  }
}
