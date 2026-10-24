import type Default from '../defaults/ThemeIllustration.vue'
import entries from '#micelio/slots/ThemeIllustration.mjs'
import { defineSlot } from '../slot'

/** The `ThemeIllustration` slot, in the active theme's component (ADR 0005, section 4). */
export default defineSlot<typeof Default>('ThemeIllustration', entries)
