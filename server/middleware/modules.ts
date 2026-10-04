import { defaultLocale } from '~/interfaces'
import { isModuleEnabled, moduleForPath } from '~/helpers/modules'

// A switched-off module's routes and pages answer 404 (docs/api.md, Modules)
export default defineEventHandler(async (event) => {
  const module = moduleForPath(event.path)
  if (!module) return
  const { site } = await loadSiteCached(defaultLocale)
  if (!isModuleEnabled(site.modules, module)) {
    throw createError({ statusCode: 404, statusMessage: 'Page not found' })
  }
})
