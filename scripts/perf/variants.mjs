// Layout variant allowances of measure.mjs (ADR 0009; docs/performance.md, "Layout variants"). Pure but for reading the build's store.

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

// Every page renders the header and the footer; these pages also render a content region
const CHROME = ['header', 'footer']
const PAGE_REGIONS = { 'home': ['home'], 'home-es': ['home'], 'blog': ['postList'], 'article': ['article'] }

/**
 * The layouts of the build's theme and of the theme under test, from the built-in store of a server build
 * (`.output/server/micelio/store`, `modules/theme/built-in-store.ts`); undefined when there is none (a static site, another server).
 * `entriesDir` is the folder of the compiled entries, `<storeDir>/<STORE_DIR>/entries`.
 */
export function storeLayouts(storeDir, entriesDir, theme) {
  const indexFile = join(storeDir, 'index.json')
  if (!existsSync(indexFile)) return undefined
  const index = JSON.parse(readFileSync(indexFile, 'utf8'))
  const layoutOf = (id) => {
    const entry = index.themes?.[id]
    if (!entry) throw new Error(`theme "${id}" is not in the built-in store of this build; it holds: ${Object.keys(index.themes ?? {}).join(', ')}`)
    return JSON.parse(readFileSync(join(entriesDir, entry.digest, 'runtime.json'), 'utf8')).layout
  }
  return { build: layoutOf(index.buildTheme), active: layoutOf(theme) }
}

/**
 * The JS a page may add for the variants the theme under test uses and the build's theme does not: each is a chunk of
 * its own that the page loads, while the build's own variant stays bundled with its region (`defineRegion`).
 * `kb` is the sum of their allowances, `variants` names them as `region:variant`.
 */
export function variantAllowance(layouts, page, allowances) {
  if (!layouts) return { kb: 0, variants: [] }
  const variants = [...CHROME, ...(PAGE_REGIONS[page] ?? [])]
    .filter(region => layouts.active[region] !== layouts.build[region])
    .map(region => `${region}:${layouts.active[region]}`)
  const kb = variants.reduce((sum, key) => sum + allowances[key.split(':')[0]][key.split(':')[1]], 0)
  return { kb: Math.round(kb * 10) / 10, variants }
}

/** Problems of the `variants` section of budgets.json against the core's variants (`REGION_VARIANTS`), one message each */
export function variantBudgetErrors(regionVariants, section) {
  if (!section?.reason) return ['variants needs a "reason"']
  const errors = []
  for (const [region, { variants }] of Object.entries(regionVariants)) {
    for (const variant of variants) {
      const kb = section.jsKb?.[region]?.[variant]
      if (typeof kb !== 'number' || !(kb > 0)) errors.push(`variants.jsKb.${region}.${variant} must be a positive number of KB`)
    }
  }
  for (const [region, entries] of Object.entries(section.jsKb ?? {})) {
    for (const variant of Object.keys(entries)) {
      if (!regionVariants[region]?.variants.includes(variant)) errors.push(`variants.jsKb.${region}.${variant} is not a layout variant of the core`)
    }
  }
  return errors
}
