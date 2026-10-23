import type Bar from './Bar.vue'
import variants from '#micelio/regions/header.mjs'
import { defineRegion } from '../region'

/** The header region, in the variant the active theme chose (ADR 0005, section 5). */
export default defineRegion<typeof Bar>('header', 'RegionHeader', variants)
