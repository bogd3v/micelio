import type { ThemeContext } from './context'

// Variant components per region and their CSS (ctx.layoutCss[region]); one line per region so the PRs do not collide
const REGIONS = {
  header: (_ctx: ThemeContext): void => {}, // PR 6a
  footer: (_ctx: ThemeContext): void => {}, // PR 6a
  home: (_ctx: ThemeContext): void => {}, // PR 6c
  postList: (_ctx: ThemeContext): void => {}, // PR 6b
  article: (_ctx: ThemeContext): void => {}, // PR 6b
}

export function setupLayout(ctx: ThemeContext): void {
  for (const setupRegion of Object.values(REGIONS)) setupRegion(ctx)
}
