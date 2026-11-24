/**
 * Puts the keys of a record in alphabetical order, in place.
 *
 * @remarks
 * The Nuxt payload lists each data call in the order the calls finished, which varies between renders of one page; the payload shares each object once, so that order decides where the object is written and how long the HTML is (bogd3v/micelio#980). A sorted record is written the same way every time.
 *
 * @param entries - The record to reorder; `undefined` is left alone
 * @returns The same record
 */
export function sortKeys<T extends Record<string, unknown>>(entries: T | undefined): T | undefined {
  if (!entries) return entries
  const sorted = Object.keys(entries).sort()
  const values = sorted.map(key => entries[key])
  for (const key of sorted) Reflect.deleteProperty(entries, key)
  sorted.forEach((key, index) => Reflect.set(entries, key, values[index]))
  return entries
}
