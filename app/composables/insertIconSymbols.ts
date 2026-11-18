import { iconSymbolIdOf } from '~/helpers/icons'

/**
 * Inserts the symbols a page-data response carries (`iconSymbols`) to the page's sprite, so the icons of a page the browser renders by itself are drawn.
 *
 * @remarks
 * Loaded by `addIconSymbols` only when a response carries symbols, so a page that has none pays nothing for it. Does nothing on the server, which builds the sprite of the first page itself (`server/plugins/iconSprite.ts`). In the browser it finds the
 * sprite (`#myc-icons`) or creates it, and appends each symbol the sprite does not hold yet. Text that is not a symbol of the shape the server
 * writes (`iconSymbolIdOf`) is left out. Call it where the response arrives, before the page renders.
 */
export function insertIconSymbols(symbols: Record<string, string> | undefined): void {
  if (!import.meta.client || !symbols) return
  let sprite: Element | null = document.getElementById('myc-icons')
  for (const [id, markup] of Object.entries(symbols)) {
    if (iconSymbolIdOf(markup) !== id) continue
    if (!sprite) {
      sprite = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
      sprite.setAttribute('id', 'myc-icons')
      for (const [name, value] of [['width', '0'], ['height', '0'], ['aria-hidden', 'true'], ['focusable', 'false'], ['style', 'position:absolute;overflow:hidden']] as const) sprite.setAttribute(name, value)
      document.body.prepend(sprite)
    }
    if (!document.getElementById(id)) sprite.insertAdjacentHTML('beforeend', markup)
  }
}
