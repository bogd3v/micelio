/**
 * The URL-safe slug of a text, used for heading ids and section anchors.
 *
 * @remarks
 * Accents are removed and the text is lowercased. Only `a-z`, `0-9` and `-` remain: other characters are dropped, so a text with
 * none of them gives an empty string. Runs of spaces and hyphens become one hyphen, and there is none at either end.
 */
export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}
