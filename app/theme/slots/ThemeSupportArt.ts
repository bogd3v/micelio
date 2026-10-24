import type Default from '../defaults/ThemeSupportArt.vue'
import entries from '#micelio/slots/ThemeSupportArt.mjs'
import { defineSlot } from '../slot'

/** The `ThemeSupportArt` slot, in the active theme's component (ADR 0005, section 4). */
export default defineSlot<typeof Default>('ThemeSupportArt', entries)
