import type { UnpackRule } from './types'

/** A package broke a rule of the safe unpack; `rule` and `path` say which. */
export class UnpackError extends Error {
  readonly rule: UnpackRule
  /** The entry that broke it, `null` when the rule is about the package as a whole. */
  readonly path: string | null

  constructor(rule: UnpackRule, detail: string, path: string | null = null) {
    super(`${rule}: ${path === null ? '' : `${path}: `}${detail}`)
    this.name = 'UnpackError'
    this.rule = rule
    this.path = path
  }
}
