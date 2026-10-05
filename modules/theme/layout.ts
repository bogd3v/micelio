import type { ThemeContext } from './context'
import { setupHeaderFooter } from './layout/header-footer'
import { setupHome } from './layout/home'
import { setupPostListArticle } from './layout/post-list-article'

// One file per PR (6a, 6c, 6b) so they never edit the same lines; this file is not edited again
export function setupLayout(ctx: ThemeContext): void {
  setupHeaderFooter(ctx)
  setupHome(ctx)
  setupPostListArticle(ctx)
}
