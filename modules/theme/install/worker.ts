import { InstallError } from './error'
import { installTheme } from './install'
import type { InstallOptions, InstallSource } from './types'
import type { WorkerReply } from './isolated'

// The child process of `installIsolated`: one install per process, then exit. It reads nothing but the one message it is sent.

process.once('message', async (message: { source: InstallSource, options: InstallOptions }) => {
  let reply: WorkerReply
  try {
    reply = { ok: true, result: await installTheme(message.source, message.options), maxRssKb: process.resourceUsage().maxRSS }
  } catch (error) {
    reply = error instanceof InstallError
      ? { ok: false, rule: error.rule, subject: error.subject, detail: error.detail }
      : { ok: false, rule: 'compile', subject: {}, detail: 'the install failed unexpectedly' }
    if (!(error instanceof InstallError)) console.error('theme install failed:', error)
  }
  process.send?.(reply, () => process.exit(0))
})
