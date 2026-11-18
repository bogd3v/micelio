import type { IconRequest, IconStyle } from '~/interfaces/icons'
import { iconSymbolId } from '~/helpers/icons'

/**
 * The `href` of an icon's `<symbol>` in the page's sprite; on the server it also records that the page uses the icon.
 *
 * @remarks
 * The sprite is built once per render by `server/plugins/iconSprite.ts` from what this records, so it holds only the names the page
 * uses. Nothing is recorded in the browser: the sprite of the page the server (or the static build) wrote is the one it has.
 */
export function useIconSprite(name: string, style: IconStyle = 'outline'): string {
  // `useRequestEvent` answers nothing in the browser
  const context = useRequestEvent()?.context
  if (context) {
    const used = (context.iconSprite ??= new Map<string, IconRequest>()) as Map<string, IconRequest>
    used.set(iconSymbolId(name, style), { name, style })
  }
  return `#${iconSymbolId(name, style)}`
}
