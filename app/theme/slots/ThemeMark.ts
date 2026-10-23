import type Default from '../defaults/ThemeMark.vue'
import entries from '#micelio/slots/ThemeMark.mjs'
import { defineSlot } from '../slot'

/** The `ThemeMark` slot, in the active theme's component (ADR 0005, section 4). */
export default defineSlot<typeof Default>('ThemeMark', entries)
