import type { ThemeStatus } from '~/interfaces/theme'

// The CMS reads this to tell an editor whether the theme they picked took effect. Public and cheap: the state is in memory, nothing calls Strapi or the registry.
export default defineEventHandler((event): ThemeStatus => {
  setHeader(event, 'Cache-Control', 'public, s-maxage=5, stale-while-revalidate=10')
  return themeStatus()
})
