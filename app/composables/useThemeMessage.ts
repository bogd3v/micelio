/**
 * A message the active theme may provide under `theme.<key>` (ADR 0005, section 4): the theme's text when it has one,
 * else the core message `fallback`, else an empty string.
 */
export function useThemeMessage(): (key: string, fallback?: string) => string {
  const { t, te } = useI18n()
  return (key: string, fallback?: string): string => {
    if (te(`theme.${key}`)) return t(`theme.${key}`)
    return fallback ? t(fallback) : ''
  }
}
