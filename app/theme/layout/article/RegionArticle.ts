import type Aside from './Aside.vue'
import variants from '#micelio/regions/article.mjs'
import { defineRegion } from '../region'

/** The article region, in the variant the active theme chose (ADR 0005, section 5). */
export default defineRegion<typeof Aside>('article', 'RegionArticle', variants)
