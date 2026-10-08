import { HYDRATED_EVENT, HYDRATED_FLAG } from '~/islands/lib/hydrated'

// Tells the islands the page has hydrated (`whenHydrated()`; ADR 0006, section 6)
export default defineNuxtPlugin((nuxtApp) => {
  nuxtApp.hook('app:suspense:resolve', () => {
    Object.assign(window, { [HYDRATED_FLAG]: true })
    document.dispatchEvent(new Event(HYDRATED_EVENT))
  })
})
