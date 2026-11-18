/** The two drawings of an icon name: `outline` (every name) and `filled` (about a thousand); `outline` is the default (ADR 0021, section 1). */
export type IconStyle = 'outline' | 'filled'

/** An icon a page asks for: the name and the style it draws it in. */
export interface IconRequest {
  name: string
  style: IconStyle
}

/** What a page-data response adds when it uses icons: the symbol of each, by symbol id, for a client-side navigation to add to the page's sprite (ADR 0021, section 3). */
export interface IconSymbolCarrier {
  iconSymbols?: Record<string, string>
}
