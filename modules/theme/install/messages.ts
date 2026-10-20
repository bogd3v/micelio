import { baseCompile } from '@intlify/message-compiler'
import { MESSAGE_NAMESPACE } from './constants'

interface Messages {
  [key: string]: string | Messages
}

/** Keys that would reach the prototype of an object built from the messages. */
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])

/**
 * Compiles every message of a locale to the AST format vue-i18n reads without its runtime compiler.
 *
 * @remarks
 * Keeps the nesting of `messages`. Called at build time by the module's `load` hook, for each locale file imported, and by the
 * theme compiler. A message with a syntax error throws, and the error names its dotted key.
 *
 * @param messages - The messages of one locale file, as parsed from its JSON.
 * @param path - Dotted prefix of the keys of `messages`, empty at the top of a file; it only names the key in an error.
 * @throws `Error` for the first message that does not compile.
 */
export function compileMessages(messages: Messages, path = ''): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(messages).map(([key, value]) => [
      key,
      typeof value === 'string'
        ? compileMessage(value, `${path}${key}`)
        : compileMessages(value, `${path}${key}.`),
    ]),
  )
}

function compileMessage(message: string, key: string): unknown {
  return baseCompile(message, {
    jit: true,
    minify: true,
    location: false,
    onError(error: Error): never {
      throw new Error(`i18n message "${key}": ${error.message}`)
    },
  }).ast
}

/** The first rule a theme's messages break, or `null`: only the `theme` namespace, strings and objects, no prototype keys. */
export function messageProblem(messages: unknown, path = ''): string | null {
  if (typeof messages !== 'object' || messages === null || Array.isArray(messages)) return `${path || 'the file'} is not an object of messages`
  for (const [key, value] of Object.entries(messages)) {
    const dotted = `${path}${key}`
    if (FORBIDDEN_KEYS.has(key)) return `"${dotted}" is not an allowed message key`
    if (path === '' && key !== MESSAGE_NAMESPACE) return `"${key}" is outside the "${MESSAGE_NAMESPACE}." namespace a theme's messages may use`
    if (typeof value === 'string') continue
    const nested = messageProblem(value, `${dotted}.`)
    if (nested !== null) return nested
  }
  return null
}
