/**
 * Formatting presets for display dates.
 * - `full` (default): "May 27, 2026" (long month, numeric day, numeric year)
 * - `short`: "May 27, 2026" (abbreviated month, numeric day, numeric year)
 * - `abbreviated`: "May 27" (abbreviated month, numeric day, no year)
 */
type DateFormatStyle = 'full' | 'short' | 'abbreviated'

/**
 * Formats an ISO date string for user-facing display.
 * Returns empty string for falsy/undefined input.
 *
 * @param date - ISO date string
 * @param style - Formatting style preset
 * @param locale - BCP 47 locale string (e.g., 'en-US', 'es-CO'). Defaults to 'en-US'.
 */
export function formatDate(date: string | null | undefined, style: DateFormatStyle = 'full', locale: string = 'en-US'): string {
  if (!date) return ''

  const options: Intl.DateTimeFormatOptions = {
    day: 'numeric',
    ...(style === 'full'
      ? { month: 'long', year: 'numeric' }
      : style === 'short'
        ? { month: 'short', year: 'numeric' }
        : { month: 'short' }),
  }

  return new Date(date).toLocaleDateString(locale, options)
}

export function formatDotDate(date: string | null | undefined): string {
  if (!date) return ''

  const parts = new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Bogota',
  }).formatToParts(new Date(date))
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(p => p.type === type)?.value ?? ''

  return `${part('day')}.${part('month')}.${part('year')}`
}

export function formatDotDateTime(date: string | null | undefined): string {
  if (!date) return ''

  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'America/Bogota',
  }).formatToParts(new Date(date))
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find(p => p.type === type)?.value ?? ''

  return `${formatDotDate(date)} · ${part('hour')}:${part('minute')}`
}
