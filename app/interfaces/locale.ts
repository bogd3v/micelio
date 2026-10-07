import type { LocationQuery } from 'vue-router'

export enum Locale {
  English = 'en',
  SpanishColombia = 'es',
}

export type LocaleCode = Locale | string

export const defaultLocale = Locale.English

export interface LocaleSwitchTarget {
  path: string
  query: LocationQuery
  hash: string
}

export type LocalePaths = Partial<Record<Locale, string>>

export interface LocaleAlternates {
  path: string
  paths: LocalePaths
  /** False: the page lists no hreflang alternates, but the language switcher still uses `paths` */
  hreflang?: boolean
}
