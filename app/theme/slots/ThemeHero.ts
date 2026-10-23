import type Default from '../defaults/ThemeHero.vue'
import entries from '#micelio/slots/ThemeHero.mjs'
import { defineSlot } from '../slot'

/** The `ThemeHero` slot, in the active theme's component (ADR 0005, section 4). */
export default defineSlot<typeof Default>('ThemeHero', entries)
