import { join } from 'node:path'
import { addTemplate, addTypeTemplate } from 'nuxt/kit'
import type { ThemeContext } from './types'
import { LAYOUT_REGIONS } from './constants'
import { REGIONS_DIR, regionVariantsModule, registerAlternates, registerVariants, variantsWithoutPrefetch } from './layout/variants'
import { specimenEnabled } from './specimen/setup'

// The variant check itself is part of the contract (contract.ts)
/**
 * Registers the component of each layout region, and on the specimen the variants the build's theme does not use.
 *
 * @remarks
 * Runs in the module setup, at build time. Each region's component (`registerVariants`) chooses the active theme's variant
 * at runtime from `#micelio/regions/<region>.mjs`, which bundles the build's theme's variant and loads the others on
 * demand (`regionVariantsModule`); the client never prefetches them (`variantsWithoutPrefetch`). The alternates'
 * components and CSS come only when `specimenEnabled` is true, so no other build bundles them.
 */
export function setupLayout(ctx: ThemeContext): void {
  const layoutRoot = join(ctx.nuxt.options.srcDir, 'theme/layout')
  ctx.nuxt.options.alias['#micelio/regions'] = join(ctx.nuxt.options.buildDir, REGIONS_DIR)
  for (const region of LAYOUT_REGIONS) {
    addTemplate({
      filename: `${REGIONS_DIR}/${region}.mjs`,
      write: true,
      getContents: () => regionVariantsModule(region, layoutRoot, ctx.load().manifest.layout?.[region]),
    })
  }
  addTypeTemplate({
    filename: 'types/micelio-regions.d.ts',
    getContents: () => `declare module '#micelio/regions/*' {\n  const variants: Record<string, import('~/theme/layout/region').RegionVariant>\n  export default variants\n}\n`,
  })
  registerVariants(ctx)
  ctx.nuxt.hook('build:manifest', (manifest) => {
    variantsWithoutPrefetch(manifest, ctx.nuxt.options.srcDir)
  })
  // /_theme shows the variants the theme does not use; no other build bundles them
  if (specimenEnabled(ctx)) registerAlternates(ctx)
}
