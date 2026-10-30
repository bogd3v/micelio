import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { LAYOUT_REGIONS, SLOT_NAMES } from '../modules/theme/constants'
import { compileMessages } from '../modules/theme/install/messages'

interface Messages {
  [key: string]: string | Messages
}

const root = join(__dirname, '..')

function read(path: string): Messages {
  return JSON.parse(readFileSync(join(root, path), 'utf8')) as Messages
}

function keys(messages: Messages, prefix = ''): string[] {
  return Object.entries(messages).flatMap(([key, value]) => typeof value === 'string' ? [`${prefix}${key}`] : keys(value, `${prefix}${key}.`))
}

describe('the starter theme messages', () => {
  const en = read('themes/starter/i18n/en.json')
  const es = read('themes/starter/i18n/es.json')

  it('declare the same keys in both locales, all under theme.*', () => {
    expect(keys(es)).toEqual(keys(en))
    expect(keys(en).every(key => key.startsWith('theme.'))).toBe(true)
  })

  it('compile with the message precompiler', () => {
    expect(() => compileMessages(en)).not.toThrow()
    expect(() => compileMessages(es)).not.toThrow()
  })
})

describe('the starter layout and slots', () => {
  const manifest = JSON.parse(readFileSync(join(root, 'themes/starter/theme.json'), 'utf8')) as { layout: Record<string, string>, slots?: Record<string, { island?: boolean }> }

  it('names a variant for every layout region', () => {
    expect(Object.keys(manifest.layout).sort()).toEqual([...LAYOUT_REGIONS].sort())
  })

  it('declares only known slots', () => {
    expect(Object.keys(manifest.slots ?? {}).every(name => (SLOT_NAMES as readonly string[]).includes(name))).toBe(true)
  })
})
