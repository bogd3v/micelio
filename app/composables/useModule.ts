import type { ComputedRef } from 'vue'
import type { SiteModule } from '~/interfaces'
import { isModuleEnabled } from '~/helpers/modules'

/** Whether a module is on for this site (useSite().modules, already limited to what the server has configured). */
export function useModule(module: SiteModule): ComputedRef<boolean> {
  const site = useSite()
  return computed<boolean>(() => isModuleEnabled(site.value.modules, module))
}
