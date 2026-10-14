import { unexpectedErrorCause } from '../lib/log'

/** Writes a structured line for every error nobody handled (a bug, a crash), which Nitro reports on its own as free text (ASVS V16.3.4). */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, context) => {
    const { unhandled, fatal } = error as { unhandled?: boolean, fatal?: boolean }
    if (!unhandled && !fatal) return
    // The cause is the error's name and code: its message can hold a URL or a value the visitor sent
    logError('server.unhandled', 'An unexpected error was not handled', { event: context?.event, cause: unexpectedErrorCause(error.cause ?? error) })
  })
})
