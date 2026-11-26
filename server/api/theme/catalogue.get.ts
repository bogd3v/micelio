import type { ThemeCatalogue } from '~/interfaces/theme'

// The Themes page of the CMS reads this from its server (bogd3v/micelio-plugin-core#59). Answered from memory: the index and the reports are read in the background (ADR 0009, sections 3 and 6).
export default defineEventHandler((event): ThemeCatalogue => {
  setHeader(event, 'Cache-Control', 'public, s-maxage=60')
  return themeCatalogue()
})
