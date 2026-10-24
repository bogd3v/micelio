import type Default from '../defaults/ThemeEmptyState.vue'
import entries from '#micelio/slots/ThemeEmptyState.mjs'
import { defineSlot } from '../slot'

/** The `ThemeEmptyState` slot, in the active theme's component (ADR 0005, section 4). */
export default defineSlot<typeof Default>('ThemeEmptyState', entries)
