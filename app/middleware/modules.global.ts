import type { Site } from '~/interfaces'
import { isModuleEnabled, moduleForPath } from '~/helpers/modules'

// Client-side navigation to a switched-off module's page; the server middleware covers full loads
export default defineNuxtRouteMiddleware((to) => {
  const module = moduleForPath(to.path)
  if (!module) return
  const { data } = useNuxtData<Site>(`site-${useNuxtApp().$i18n.locale.value}`)
  if (data.value && !isModuleEnabled(data.value.modules, module)) {
    return abortNavigation(createError({ statusCode: 404, statusMessage: 'Page not found', fatal: true }))
  }
})
