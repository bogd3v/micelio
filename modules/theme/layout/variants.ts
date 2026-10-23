import { existsSync, readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import type { ThemeContext, LayoutRegion } from '../types'
import { LAYOUT_REGIONS } from '../constants'
import type { LayoutCss } from '../install/types'

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

/**
 * Reads the core's CSS of every layout variant from `app/theme/layout/<region>/<variant>.css`.
 *
 * @remarks
 * The theme store compiles the CSS of the variants a theme chose into that theme's stylesheet (ADR 0009, section 6), so a page
 * loads only its own variants. `layoutRoot` is the folder `app/theme/layout`.
 */
export function readLayoutCss(layoutRoot: string): LayoutCss {
  const css: LayoutCss = {}
  for (const region of LAYOUT_REGIONS) {
    const found: Record<string, string> = {}
    for (const variant of REGION_VARIANTS[region].variants) {
      const file = join(layoutRoot, region, `${variant}.css`)
      if (existsSync(file)) found[variant] = readFileSync(file, 'utf8')
    }
    css[region] = found
  }
  return css
}

/**
 * Registers the component of each region, `app/theme/layout/<region>/Region<Name>.ts`, which picks the variant at runtime.
 *
 * @remarks
 * Every variant of the core is in the build, each in its own chunk, so a theme from the store may use any of them
 * (`defineRegion`, ADR 0009). Their CSS travels in the theme's stylesheet (`readLayoutCss`).
 */
export function registerVariants(ctx: ThemeContext, regions: readonly LayoutRegion[] = LAYOUT_REGIONS): void {
  const base = join(ctx.nuxt.options.srcDir, 'theme/layout')
  for (const region of regions) {
    const { component } = REGION_VARIANTS[region]
    ctx.components.push({ name: component, filePath: join(base, region, `${component}.ts`) })
  }
}

/** The folder of the build directory that holds `#micelio/regions/<region>.mjs`. */
export const REGIONS_DIR = 'micelio/regions'

/**
 * The source of `#micelio/regions/<region>.mjs`: every variant of the region, for `defineRegion`.
 *
 * @remarks
 * The variant `chosen` (the build's theme's; the region's first when it names none or one the core does not have) is
 * imported statically, so it is bundled with the region as before #402; every other variant is a dynamic import, its own
 * chunk. The entries keep the order of `REGION_VARIANTS`, the default first. The code is written only from the core's own
 * variant names, which are plain identifiers, and imports through the `~` alias: no path or theme value is interpolated.
 */
export function regionVariantsModule(region: LayoutRegion, chosen?: string): string {
  const { variants } = REGION_VARIANTS[region]
  const bundled = variants.find(variant => variant === chosen) ?? variants[0]!
  const file = (variant: string): string => `'~/theme/layout/${region}/${pascal(variant)}.vue'`
  const entries = variants.map(variant => variant === bundled
    ? `  ${variant}: { component: Chosen },`
    : `  ${variant}: { load: () => import(${file(variant)}) },`)
  return `// Generated by modules/theme/layout/variants.ts (regionVariantsModule)\nimport Chosen from ${file(bundled)}\n\nexport default {\n${entries.join('\n')}\n}\n`
}

/** The client build manifest, as far as `variantsWithoutPrefetch` reads it. */
export type ManifestEntries = Record<string, { src?: string, prefetch?: boolean }>

/**
 * Stops the client from prefetching the variants a page does not render.
 *
 * @remarks
 * Each region imports all its variants on demand (`defineRegion`), and Nuxt prefetches a page's dynamic imports, so without
 * this every page would download the variants of other themes at idle. The chosen variant still gets its `modulepreload`,
 * because the server rendered it. `srcDir` is the folder the manifest's `src` paths are relative to.
 */
export function variantsWithoutPrefetch(manifest: ManifestEntries, srcDir: string): void {
  const files = new Set(LAYOUT_REGIONS.flatMap(region => REGION_VARIANTS[region].variants.map(variant => join(srcDir, 'theme/layout', region, `${pascal(variant)}.vue`))))
  for (const entry of Object.values(manifest)) {
    if (entry.src && files.has(resolve(srcDir, entry.src))) entry.prefetch = false
  }
}

/**
 * Specimen only (MICELIO_SPECIMEN=1, dev): every variant the theme does not use is registered under its own name
 * (`RegionHeaderCentered`) with its CSS, which is scoped by `data-layout` and, for the header's `html` rules, by
 * `data-layout-header`. The CSS goes in the bundle; the active variant's own CSS is in the theme's stylesheet.
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
