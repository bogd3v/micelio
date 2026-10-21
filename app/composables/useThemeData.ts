import type { ThemeData } from '~/interfaces'

/**
 * The active theme's data: modes, images, layout variants and Mermaid overrides.
 *
 * @remarks
 * The server puts it in the shared state `myc-theme-data` from the request context on the first call, and the client reads it from
 * the payload, so a page never imports the theme. The object is shared between requests: do not change it.
 *
 * @throws `Error` when the server did not set it, which means the theme plugin did not run.
 */
export function useThemeData(): ThemeData {
  const state = useState<ThemeData | undefined>('myc-theme-data', () => (import.meta.server ? useRequestEvent()?.context.theme : undefined))
  if (!state.value) throw new Error('The active theme is not loaded: the server did not provide it')
  return state.value
}
