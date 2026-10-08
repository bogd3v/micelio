import type { Page } from '@playwright/test'

// Scroll-driven animations that change a value, not a position: the static reading percentage (a counter) and the
// back-to-top link, which under reduced motion turns visible in one step. Reduced motion keeps them (#245, PR 3)
export const NON_MOTION_ANIMATIONS = ['bd-read-count', 'bd-back-to-top-in']

/** Animations on the page other than the value-only ones above. */
export async function motionAnimations(page: Page): Promise<string[]> {
  return page.evaluate(names => document.getAnimations()
    .map(animation => (animation as CSSAnimation).animationName ?? animation.id ?? 'unnamed')
    .filter(name => !names.includes(name)), NON_MOTION_ANIMATIONS)
}
