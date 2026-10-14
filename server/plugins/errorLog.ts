import { isError } from 'h3'
import { unexpectedErrorCause } from '../lib/log'

/** Tags Nitro puts on an error that crashed the process instead of a request. */
const CRASH_TAGS = ['uncaughtException', 'unhandledRejection']

/**
 * Writes a structured line for every error nobody handled: a bug in a request, an error raised outside one (a hook, a rejected promise) or a crash.
 *
 * @remarks
 * Nitro reports these on its own as free text (ASVS V16.3.4). An error that is an H3 error and not marked `unhandled` or `fatal` was thrown on purpose by the code that handled it, which logged it already.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.hooks.hook('error', (error, context) => {
    const { unhandled, fatal } = error as { unhandled?: boolean, fatal?: boolean }
    const tags = (context as { tags?: string[] } | undefined)?.tags ?? []
    const crashed = tags.some(tag => CRASH_TAGS.includes(tag))
    if (!unhandled && !fatal && !crashed && isError(error)) return
    // The cause is the error's name and code: its message can hold a URL or a value the visitor sent
    logError('server.unhandled', 'An unexpected error was not handled', { event: context?.event, cause: unexpectedErrorCause(error.cause ?? error) })
  })
})
