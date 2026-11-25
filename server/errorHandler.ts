// @ts-expect-error -- the alias is set in nuxt.config.ts and points at Nuxt's own handler, which has no types
import nuxtErrorHandler from '#nuxt-error-handler'
import { silenceDefaultReport } from './lib/silentErrorHandler'
import type { NitroErrorHandler } from './lib/silentErrorHandler'

/** Nuxt's error handler for pages, without Nitro's free-text report of an unhandled error (ASVS V16.2.4) and without the query of the address in any error answer (ADR 0019, section 3). */
export default silenceDefaultReport(nuxtErrorHandler as NitroErrorHandler)
