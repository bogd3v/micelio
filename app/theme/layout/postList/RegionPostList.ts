import type Grid from './Grid.vue'
import variants from '#micelio/regions/postList.mjs'
import { defineRegion } from '../region'

/** The post list region, in the variant the active theme chose (ADR 0005, section 5). */
export default defineRegion<typeof Grid>('postList', 'RegionPostList', variants)
