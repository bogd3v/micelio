import type Default from '../defaults/ThemeDivider.vue'
import entries from '#micelio/slots/ThemeDivider.mjs'
import { defineSlot } from '../slot'

/** The `ThemeDivider` slot, in the active theme's component (ADR 0005, section 4). */
export default defineSlot<typeof Default>('ThemeDivider', entries)
