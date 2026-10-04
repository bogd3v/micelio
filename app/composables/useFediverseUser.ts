import { fediverseUser } from '~/helpers/site'

/** The site's fediverse account as shown in the UI (`@bogdev`), from `public.fediverseHandle`. */
export function useFediverseUser(): string {
  return fediverseUser(useRuntimeConfig().public.fediverseHandle)
}
