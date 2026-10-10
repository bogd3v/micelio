import type { ComputedRef } from 'vue'

/** The place line a theme may show (header, hero, footer, article byline); a field is undefined when the theme has no message for it. */
interface ThemeHud {
  city?: string
  coords?: string
  altitude?: string
  madeIn?: string
}

const FIELDS = ['city', 'coords', 'altitude', 'madeIn'] as const

/** Reads `theme.hud.*` from the active theme's messages (ADR 0005, section 4); a theme without them shows no place line. */
export function useThemeHud(): ComputedRef<ThemeHud> {
  const { t, te } = useI18n()
  return computed<ThemeHud>(() =>
    Object.fromEntries(FIELDS.filter(field => te(`theme.hud.${field}`)).map(field => [field, t(`theme.hud.${field}`)])),
  )
}
