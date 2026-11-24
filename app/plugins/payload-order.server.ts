import { sortKeys } from '~/helpers/payloadOrder'

// The payload lists each data call under its key in the order the calls finished, and `/api/categories` (asked by the menu, the cards and the
// search palette) races the page's own data. The payload shares each object it holds once, so that order changes where the object is written
// and the length of the HTML by a few hundred bytes. The weight of a draft is the difference between two renders of it (ADR 0019), so one
// block weighed 2.7 kB in a report and 2.8 kB in the next (bogd3v/micelio#980). Sorting the keys before the payload is written gives the same
// bytes on every render of the same content.
export default defineNuxtPlugin({
  name: 'payload-order',
  setup(nuxtApp) {
    nuxtApp.hooks.hook('app:rendered', ({ ssrContext }) => {
      sortKeys(ssrContext?.payload?.data as Record<string, unknown> | undefined)
      sortKeys(ssrContext?.payload?.state as Record<string, unknown> | undefined)
    })
  },
})
