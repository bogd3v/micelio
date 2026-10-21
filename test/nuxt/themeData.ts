import bogota from '../../themes/bogota/theme.json'
import { DEFAULT_LAYOUT } from '../../modules/theme/constants'
import type { ThemeData } from '../../app/interfaces/theme'

// What the server puts in the payload for the active theme (Bogota), built from its theme.json so a test sees the real modes,
// images, layout and Mermaid overrides. The digest is a stand-in: the tests do not serve /_t/.

const DIGEST = 'f'.repeat(64)
const manifest = bogota as unknown as {
  id: string
  modes: ThemeData['modes']
  images?: Record<string, string>
  layout?: Partial<ThemeData['layout']>
  mermaid?: ThemeData['mermaid']
}

/** The data of Bogota as the pages receive it. */
export const BOGOTA_THEME_DATA: ThemeData = {
  id: manifest.id,
  digest: DIGEST,
  modes: manifest.modes.map(({ id, scheme, name }) => ({ id, scheme, name })),
  images: Object.fromEntries(Object.entries(manifest.images ?? {}).map(([role, file]) => [role, `/_t/${DIGEST}/images/${file}`])),
  layout: { ...DEFAULT_LAYOUT, ...manifest.layout },
  mermaid: manifest.mermaid ?? {},
}

/** Replaces the theme data of the running test app; `changes` are merged over Bogota's. */
export function setThemeData(changes: Partial<ThemeData> = {}): void {
  useNuxtApp().payload.state['$smyc-theme-data'] = { ...BOGOTA_THEME_DATA, ...changes }
}
