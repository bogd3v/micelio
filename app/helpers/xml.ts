/**
 * The text escaped for an XML text node or a double- or single-quoted attribute.
 *
 * @remarks
 * Escapes `&` first so that nothing is escaped twice. Use it for every value that comes from the CMS and is written into feed or sitemap markup, a URL included.
 */
export function escapeXml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll('\'', '&apos;')
}
