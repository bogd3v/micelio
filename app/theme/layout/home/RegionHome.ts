import type Showcase from './Showcase.vue'
import variants from '#micelio/regions/home.mjs'
import { defineRegion } from '../region'

/** The home region, in the variant the active theme chose (ADR 0005, section 5). */
export default defineRegion<typeof Showcase>('home', 'RegionHome', variants)
