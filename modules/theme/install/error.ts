import type { InstallRule } from './types'

/** The theme an install was about, as far as it was known when it failed. */
export interface InstallSubject {
  id?: string
  version?: string
  digest?: string
}

/** An install failed; the message names the theme, the version, the digest and the rule, and carries no file system path. */
export class InstallError extends Error {
  readonly rule: InstallRule
  readonly subject: InstallSubject
  /** What failed, without the rule and the theme in front of it. */
  readonly detail: string

  constructor(rule: InstallRule, subject: InstallSubject, detail: string, options?: ErrorOptions) {
    const who = [subject.id === undefined ? 'theme' : `theme "${subject.id}"`, subject.version, subject.digest === undefined ? undefined : `(${subject.digest})`].filter(Boolean).join(' ')
    super(`${rule}: ${who}: ${detail}`, options)
    this.name = 'InstallError'
    this.rule = rule
    this.subject = subject
    this.detail = detail
  }
}
