import type { RegistryFailure, ThemePin, UnpackRule } from './types'

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

/** A theme cannot be packed; `problems` lists every reason, one line each. */
export class PackError extends Error {
  readonly problems: string[]

  constructor(id: string, problems: string[]) {
    super(`Theme "${id}" cannot be packed:\n${problems.map(problem => `  ${problem}`).join('\n')}`)
    this.name = 'PackError'
    this.problems = problems
  }
}

/** Text from a package, a certificate or a file, made safe to print: control characters become spaces and it is cut at 200 characters. */
export function safeText(value: unknown): string {
  const isControl = (char: string): boolean => char.charCodeAt(0) < 32 || (char.charCodeAt(0) >= 127 && char.charCodeAt(0) <= 159)
  return [...String(value).slice(0, 200)].map(char => (isControl(char) ? ' ' : char)).join('')
}

/** A pin, a lock or a pull failed; the message names the theme, the version, the digest and what failed. */
export class RegistryError extends Error {
  readonly failure: RegistryFailure
  /** What failed, without the failure kind and the theme in front of it. */
  readonly detail: string
  /** The theme the failure is about, when known. */
  readonly pin: Partial<ThemePin>

  constructor(failure: RegistryFailure, detail: string, pin: Partial<ThemePin> = {}, options?: ErrorOptions) {
    const subject = [pin.id, pin.version === undefined ? undefined : `@${pin.version}`, pin.digest === undefined ? undefined : ` (${pin.digest})`].filter(Boolean).join('')
    super(`${failure}: ${subject === '' ? '' : `${subject}: `}${detail}`, options)
    this.name = 'RegistryError'
    this.failure = failure
    this.detail = detail
    this.pin = pin
  }
}

/** The same error with the theme it was about named; any other error is returned as it is. */
export function withPin(error: unknown, pin: ThemePin): unknown {
  return error instanceof RegistryError ? new RegistryError(error.failure, error.detail, pin, { cause: error }) : error
}
