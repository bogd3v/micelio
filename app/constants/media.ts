import type { InjectionKey } from 'vue'

/**
 * A same-origin path prefix whose media `SectionMedia` accepts besides Strapi uploads. Only an ancestor can provide it
 * (the /_theme specimen, which ships its own images); server-parsed pages never can, and server/schemas/page.ts does not accept it.
 */
export const TRUSTED_MEDIA_PREFIX: InjectionKey<string> = Symbol('trustedMediaPrefix')
