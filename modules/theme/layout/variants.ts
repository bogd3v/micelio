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
  header: { component: 'RegionHeader', variants: ['bar', 'centered'] },
  home: { component: 'RegionHome', variants: ['showcase'] },
  postList: { component: 'RegionPostList', variants: ['grid'] },
  article: { component: 'RegionArticle', variants: ['aside'] },
  footer: { component: 'RegionFooter', variants: ['columns', 'minimal'] },
}

function pascal(variant: string): string {
  return variant[0]!.toUpperCase() + variant.slice(1)
}

/** Registers the component and CSS of the variant the theme uses in each region; the others are never bundled. */
export function registerVariants(ctx: ThemeContext, regions: readonly LayoutRegion[] = LAYOUT_REGIONS): void {
  const base = join(ctx.nuxt.options.srcDir, 'theme/layout')
  const { layout } = ctx.load().manifest
  for (const region of regions) {
    const { component, variants } = REGION_VARIANTS[region]
    const variant = layout?.[region] ?? variants[0]!
    const name = pascal(variant)
    ctx.components.push({ name: component, filePath: join(base, region, `${name}.vue`) })
    ctx.layoutCss[region].push(() => `@import "${join(base, region, `${variant}.css`)}";`)
  }
}

/**
 * Specimen only (MICELIO_SPECIMEN=1, dev): every variant the theme does not use is registered under its own name
 * (`RegionHeaderCentered`) with its CSS, which is scoped by data-layout. The CSS goes first so the active variant's
 * `:root` and `html` rules still win.
 */
export function registerAlternates(ctx: ThemeContext, regions: readonly LayoutRegion[] = LAYOUT_REGIONS): void {
  const base = join(ctx.nuxt.options.srcDir, 'theme/layout')
  const { layout } = ctx.load().manifest
  for (const region of regions) {
    const { component, variants } = REGION_VARIANTS[region]
    const active = layout?.[region] ?? variants[0]!
    for (const variant of variants.filter(name => name !== active)) {
      ctx.components.push({ name: `${component}${pascal(variant)}`, filePath: join(base, region, `${pascal(variant)}.vue`), global: true })
      ctx.layoutCss[region].unshift(() => `@import "${join(base, region, `${variant}.css`)}";`)
    }
  }
}

/** The alternates of every region, for the specimen: `{ region, variant, component }`. */
export function alternateVariants(ctx: ThemeContext, regions: readonly LayoutRegion[] = LAYOUT_REGIONS): Array<{ region: LayoutRegion, variant: string, component: string }> {
  const { layout } = ctx.load().manifest
  return regions.flatMap((region) => {
    const { component, variants } = REGION_VARIANTS[region]
    const active = layout?.[region] ?? variants[0]!
    return variants.filter(name => name !== active).map(variant => ({ region, variant, component: `${component}${pascal(variant)}` }))
  })
}
