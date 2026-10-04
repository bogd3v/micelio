import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compile, createCoreContext, translate } from '@intlify/core-base'
import { compileMessages } from '../modules/precompile-messages'

type Messages = { [key: string]: string | Messages }

function load(locale: string): Messages {
  return JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
}

function keys(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`))
}

function render(messages: unknown, key: string, count: number): unknown {
  const context = createCoreContext({ locale: 'x', messages: { x: messages }, messageCompiler: compile })
  return translate(context, key, { count, n: count, total: count, name: 'Ada' }, count)
}

describe('compileMessages', () => {
  it('turns every message into an AST', () => {
    const compiled = compileMessages({ nav: { home: 'Home' } }) as { nav: { home: { b: unknown } } }
    expect(compiled.nav.home.b).toBeDefined()
  })

  it('throws on a message that does not compile', () => {
    expect(() => compileMessages({ home: { broken: 'Hello {name' } })).toThrow('i18n message "home.broken"')
  })

  it.each(['en', 'es'])('renders every %s message like the runtime compiler', (locale: string) => {
    const source = load(locale)
    const compiled = compileMessages(source)
    for (const key of keys(source)) {
      for (const count of [0, 1, 2]) {
        expect(render(compiled, key, count), `${key} (${count})`).toBe(render(source, key, count))
      }
    }
  })
})
