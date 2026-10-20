import type { InstallRule } from './types'

/** An install failed; the message names the theme, the version, the digest and the rule, and carries no file system path. */
export class InstallError extends Error {
  readonly rule: InstallRule

  constructor(rule: InstallRule, subject: { id?: string, version?: string, digest?: string }, detail: string, options?: ErrorOptions) {
    const who = [subject.id === undefined ? 'theme' : `theme "${subject.id}"`, subject.version, subject.digest === undefined ? undefined : `(${subject.digest})`].filter(Boolean).join(' ')
    super(`${rule}: ${who}: ${detail}`, options)
    this.name = 'InstallError'
    this.rule = rule
  }
}
