/**
 * Adds the symbols a page-data response carries (`iconSymbols`) to the page's sprite, so the icons of a page the browser renders by itself are drawn.
 *
 * @remarks
 * The code that inserts them (`insertIconSymbols`) is a chunk of its own, requested the first time a response carries symbols: the shared bundle of a site
 * with no icon on its pages is not heavier (`docs/performance.md`). Does nothing on the server, which writes the first page's sprite itself, or for a response with none.
 */
export async function addIconSymbols(symbols: Record<string, string> | undefined): Promise<void> {
  if (!import.meta.client || !symbols || Object.keys(symbols).length === 0) return
  const { insertIconSymbols } = await import('./insertIconSymbols')
  insertIconSymbols(symbols)
}
