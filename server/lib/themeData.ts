import type { RuntimeData } from '../../modules/theme/install/types'
import type { ThemeData, ThemeMessages } from '~/interfaces/theme'

function freeze<T>(value: T): T {
  if (typeof value === 'object' && value !== null) for (const child of Object.values(value)) freeze(child)
  return Object.freeze(value)
}

/**
 * The slice of the active theme that goes to every page, frozen so no request can change what the next one sees.
 *
 * @param runtime - The parsed `runtime.json` of the active entry.
 * @param sections - Whether the entry holds a `sections.css`.
 * @param defaultSlots - Whether the page renders the core's default slots whatever the id: the preview of a theme the image was not built with (ADR 0019, amendment of 2026-11-25).
 */
export function themeDataOf(runtime: RuntimeData, sections = false, defaultSlots = false): ThemeData {
  const { id, digest, modes, images, layout, mermaid } = runtime
  return freeze(structuredClone({ id, digest, modes, images, layout, mermaid, sections, ...(defaultSlots && { defaultSlots }) }))
}

/**
 * The theme's compiled messages by locale, frozen so a request can add them to its own locale messages without ever changing what the next request sees.
 *
 * @param runtime - The parsed `runtime.json` of the active entry.
 */
export function themeMessagesOf(runtime: RuntimeData): Record<string, ThemeMessages> {
  return freeze(structuredClone(runtime.messages))
}
