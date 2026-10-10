import { join } from 'node:path'
import type { ThemeContext, LayoutRegion } from '../types'
import { LAYOUT_REGIONS } from '../constants'

interface RegionVariants {
  /** Name the component is registered under. */
  component: string
  /** Variants the core implements, by file name (the first is the default). */
  variants: string[]
}

// Components live in app/theme/layout/<region>/<Variant>.vue with <variant>.css beside them (ADR 0005, section 5)
/**
 * The component and the variants the core implements, for each region of the page.
 *
 * @remarks
 * The first variant of a region is its default. The `layout` of a `theme.json` accepts exactly these names, and the theme
 * reference lists them. `component` is the name the region's chosen variant is registered under.
 */
export const REGION_VARIANTS: Record<LayoutRegion, RegionVariants> = {
  header: { component: 'RegionHeader', variants: ['bar', 'centered'] },
  home: { component: 'RegionHome', variants: ['showcase', 'index'] },
  postList: { component: 'RegionPostList', variants: ['grid', 'list'] },
  article: { component: 'RegionArticle', variants: ['aside', 'centered'] },
  footer: { component: 'RegionFooter', variants: ['columns', 'minimal'] },
}

/** What each variant is (ADR 0005, section 5); the theme reference is generated from it. */
export const VARIANT_DESCRIPTIONS: Record<LayoutRegion, Record<string, string>> = {
  header: {
    bar: 'Logo, navigation and actions in one sticky row.',
    centered: 'Logo centered above the navigation; sets `--myc-header-h` to 152px on desktop (64px on mobile).',
  },
  home: {
    showcase: 'Hero, featured article, latest articles and topic guide.',
    index: 'Site name, description and a link to the about page, then the latest articles; no hero.',
  },
  postList: {
    grid: 'Cards in a grid, with the grid and log view switch.',
    list: 'Rows with date, title and excerpt; hides the view switch.',
  },
  article: {
    aside: 'Table of contents and share buttons in side columns.',
    centered: 'One column, with the table of contents collapsed in a `<details>` above the text; the share buttons, comments and related articles follow the text.',
  },
  footer: {
    columns: 'Brand column and link columns (accordions on small screens), the support link, the `ThemeDivider` slot and the "made in" line.',
    minimal: 'A single row; leaves out the support link, the `ThemeDivider` slot and the "made in" line.',
  },
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
