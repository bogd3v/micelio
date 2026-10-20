import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { compile, createCoreContext, translate } from '@intlify/core-base'
import { isMessageFile } from '../modules/precompile-messages'
import { compileMessages, messageProblem } from '../modules/theme/install/messages'

type Messages = { [key: string]: string | Messages }

function load(locale: string): Messages {
  return JSON.parse(readFileSync(new URL(`../i18n/locales/${locale}.json`, import.meta.url), 'utf8'))
}

function keys(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) =>
    typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`))
}

function render(messages: unknown, key: string, count: number): unknown {
  const context = createCoreContext({ locale: 'en', messages: { en: messages as Messages, es: {} }, messageCompiler: compile })
  return translate(context as Parameters<typeof translate>[0], key, { count, n: count, total: count, name: 'Ada' }, count)
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

describe('isMessageFile', () => {
  const dirs = ['/app/i18n/locales', '/app/themes']

  it('accepts JSON files inside the message directories', () => {
    expect(isMessageFile('/app/i18n/locales/en.json', dirs)).toBe(true)
    expect(isMessageFile('/app/themes/bogota/i18n/es.json', dirs)).toBe(true)
  })

  it('rejects a sibling folder that only shares the prefix', () => {
    expect(isMessageFile('/app/themes-foo/en.json', dirs)).toBe(false)
    expect(isMessageFile('/app/i18n/locales-old/en.json', dirs)).toBe(false)
  })

  it('rejects files that are not JSON', () => {
    expect(isMessageFile('/app/themes/bogota/theme.css', dirs)).toBe(false)
  })
})

describe('messageProblem', () => {
  it('accepts nested messages under the theme namespace', () => {
    expect(messageProblem({ theme: { hero: { title: 'Hello {name}' } } })).toBeNull()
    expect(messageProblem({})).toBeNull()
  })

  it('refuses a key outside the namespace, a prototype key and a value that is not an object', () => {
    expect(messageProblem({ nav: { home: 'Home' } })).toContain('"nav"')
    expect(messageProblem(JSON.parse('{"theme":{"__proto__":{"x":"y"}}}'))).toContain('__proto__')
    expect(messageProblem(JSON.parse('{"theme":{"a":{"constructor":"x"}}}'))).toContain('theme.a.constructor')
    expect(messageProblem(['theme'])).toContain('not an object')
    expect(messageProblem({ theme: { n: 3 } })).not.toBeNull()
  })
})
