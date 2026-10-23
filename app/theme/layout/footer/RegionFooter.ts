import type Columns from './Columns.vue'
import variants from '#micelio/regions/footer.mjs'
import { defineRegion } from '../region'

/** The footer region, in the variant the active theme chose (ADR 0005, section 5). */
export default defineRegion<typeof Columns>('footer', 'RegionFooter', variants)
