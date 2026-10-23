import type Default from '../defaults/ThemeProgressMarker.vue'
import entries from '#micelio/slots/ThemeProgressMarker.mjs'
import { defineSlot } from '../slot'

/** The `ThemeProgressMarker` slot, in the active theme's component (ADR 0005, section 4). */
export default defineSlot<typeof Default>('ThemeProgressMarker', entries)
