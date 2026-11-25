import { send, setResponseHeader, setResponseStatus } from 'h3'
import type { H3Event } from 'h3'
import { ENTRY_FILES } from '../../modules/theme/install/constants'
import { themeDataOf, themeMessagesOf } from '../lib/themeData'
import { pinRequestToTheme, THEME_PREVIEW_HEADER } from '../lib/themeSwitch/request'
import type { PreviewedTheme } from '../lib/themeSwitch/types'
import type { ThemeData, ThemeMessages } from '~/interfaces/theme'

// The theme override of a preview grant (ADR 0019, amendment of 2026-11-25): found in a store and pinned to one draft response, never activated.

const views = new WeakMap<PreviewedTheme, { data: ThemeData, messages: Record<string, ThemeMessages> }>()

/**
 * The theme a preview grant names, from the built-in or the deployment store, or `null` (logged as `preview.theme-not-installed`) when no store holds that version of it; the caller answers `themeNotInstalled`.
 *
 * @remarks
 * Sends `x-micelio-theme-preview: rebuild-required` when it is a code theme the image was not built with: the preview renders it from its data,
 * and activating it needs an image built with it (ADR 0009, section 4). Installs, activates and evicts nothing.
 */
export async function previewedTheme(event: H3Event, wanted: { id: string, version: string }): Promise<PreviewedTheme | null> {
  const found = await previewTheme(wanted)
  if (found === null) {
    logWarn('preview.theme-not-installed', 'The preview names a theme that no theme store holds; nothing is installed', { event, cause: `${wanted.id}@${wanted.version}` })
    return null
  }
  if (found.rebuildToActivate) setHeader(event, THEME_PREVIEW_HEADER, 'rebuild-required')
  return found
}

/**
 * Answers the problem `themeNotInstalled` (409) from the route itself, as `application/problem+json`.
 *
 * @remarks
 * For `/_preview`, which is outside `/api/`: the problem details plugin does not answer its errors, and the admin reads this code. The answer holds no part of the address, so no token (ADR 0019, section 3).
 */
export function sendThemeNotInstalled(event: H3Event): Promise<void> {
  const body = problemDetailOf('themeNotInstalled')
  setResponseStatus(event, body.status, body.title)
  setResponseHeader(event, 'content-type', 'application/problem+json')
  return send(event, JSON.stringify(body))
}

/**
 * Pins this request, and only this one, to a previewed theme, as `pinRequestToTheme` pins a request to the active one: the render, the payload and `render:html` read it.
 *
 * @remarks
 * A theme the image was not built with renders the core's default slots (`ThemeData.defaultSlots`), whatever its id.
 */
export function pinRequestToPreviewTheme(event: H3Event, found: PreviewedTheme): void {
  let view = views.get(found)
  if (!view) {
    const { runtime, entry } = found.theme
    view = { data: themeDataOf(runtime, entry.files.has(ENTRY_FILES.sections), !found.builtIn), messages: themeMessagesOf(runtime) }
    views.set(found, view)
  }
  pinRequestToTheme(event, found.theme, view)
}
