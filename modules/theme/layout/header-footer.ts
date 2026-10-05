import { join } from 'node:path'
import type { ThemeContext } from '../context'
import type { LayoutRegion } from '../data'
import { checkVariant } from './post-list-article'

type HeaderFooterRegion = Extract<LayoutRegion, 'header' | 'footer'>

interface RegionVariants {
  component: string
  /** Variants the core implements, by file name (the first is the default). */
  variants: string[]
}

// Components live in app/theme/layout/<region>/<Variant>.vue with <variant>.css beside them (ADR 0005, section 5)
const REGIONS: Record<HeaderFooterRegion, RegionVariants> = {
  header: { component: 'RegionHeader', variants: ['bar'] },
  footer: { component: 'RegionFooter', variants: ['columns'] },
}

export function setupHeaderFooter(ctx: ThemeContext): void {
  const base = join(ctx.nuxt.options.srcDir, 'theme/layout')
  const entries = Object.entries(REGIONS) as Array<[HeaderFooterRegion, RegionVariants]>
  for (const [region, { variants }] of entries) {
    ctx.validators.push(manifest => checkVariant(manifest, region, variants))
  }
  const { layout } = ctx.load().manifest
  for (const [region, { component, variants }] of entries) {
    // Only the variant the theme uses is bundled
    const variant = layout?.[region] ?? variants[0]!
    const name = variant[0]!.toUpperCase() + variant.slice(1)
    ctx.components.push({ name: component, filePath: join(base, region, `${name}.vue`) })
    ctx.layoutCss[region].push(() => `@import "${join(base, region, `${variant}.css`)}";`)
  }
}
