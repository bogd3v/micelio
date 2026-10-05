import { join } from 'node:path'
import type { ThemeContext } from '../context'
import type { LayoutRegion } from '../data'

interface RegionVariants {
  component: string
  /** Variants the core implements, by file name (the first is the default). */
  variants: string[]
}

// Components live in app/theme/layout/<region>/<Variant>.vue with <variant>.css beside them (ADR 0005, section 5)
const REGIONS: Partial<Record<LayoutRegion, RegionVariants>> = {
  postList: { component: 'RegionPostList', variants: ['grid'] },
  article: { component: 'RegionArticle', variants: ['aside'] },
}

export function setupPostListArticle(ctx: ThemeContext): void {
  const base = join(ctx.nuxt.options.srcDir, 'theme/layout')
  for (const [region, { component, variants }] of Object.entries(REGIONS) as Array<[LayoutRegion, RegionVariants]>) {
    ctx.validators.push((manifest) => {
      const chosen = manifest.layout?.[region]
      if (chosen && !variants.includes(chosen)) {
        throw new Error(`Theme "${manifest.id}": layout.${region} "${chosen}" is not a variant (${variants.join(', ')})`)
      }
    })
    // Only the variant the theme uses is bundled
    const variant = ctx.load().manifest.layout?.[region] ?? variants[0]!
    const name = variant[0]!.toUpperCase() + variant.slice(1)
    ctx.components.push({ name: component, filePath: join(base, region, `${name}.vue`) })
    ctx.layoutCss[region].push(() => `@import "${join(base, region, `${variant}.css`)}";`)
  }
}
