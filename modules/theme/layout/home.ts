import { join } from 'node:path'
import type { ThemeContext } from '../context'
import { checkVariant } from './post-list-article'

const REGION = 'home'
// Variants the core implements (the first is the default); the component lives in app/theme/layout/home/
const VARIANTS = ['showcase']
const COMPONENT = 'RegionHome'

export function setupHome(ctx: ThemeContext): void {
  ctx.validators.push(manifest => checkVariant(manifest, REGION, VARIANTS))
  const base = join(ctx.nuxt.options.srcDir, 'theme/layout', REGION)
  // Only the variant the theme uses is bundled
  const variant = ctx.load().manifest.layout?.[REGION] ?? VARIANTS[0]!
  const name = variant[0]!.toUpperCase() + variant.slice(1)
  ctx.components.push({ name: COMPONENT, filePath: join(base, `${name}.vue`) })
  ctx.layoutCss[REGION].push(() => `@import "${join(base, `${variant}.css`)}";`)
}
