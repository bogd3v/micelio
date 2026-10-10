/**
 * The initials of a name: the upper-case first letter of its first two words.
 *
 * @remarks
 * Answers `fallback` when the name is empty or blank.
 */
export function initials(name: string | null | undefined, fallback = '?'): string {
  const letters = (name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(word => word.charAt(0).toUpperCase())
    .join('')
  return letters || fallback
}
