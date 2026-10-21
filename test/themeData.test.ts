import { describe, expect, it } from 'vitest'
import { themeDataOf, themeMessagesOf } from '../server/lib/themeData'
import type { RuntimeData } from '../modules/theme/install/types'

const RUNTIME = {
  id: 'sample',
  digest: 'a'.repeat(64),
  modes: [{ id: 'day', scheme: 'light', name: 'Day' }],
  images: { favicon: `/_t/${'a'.repeat(64)}/images/favicon.svg` },
  layout: { header: 'bar', home: 'showcase', postList: 'grid', article: 'aside', footer: 'columns' },
  mermaid: { primaryColor: '#fff' },
  palette: { modes: {}, rules: [] },
  messages: { en: { hero: { t: 0 } } },
  fonts: [],
} as unknown as RuntimeData

describe('themeDataOf', () => {
  it('keeps what a page needs and leaves the palette, the messages and the fonts on the server', () => {
    const data = themeDataOf(RUNTIME)
    expect(Object.keys(data).sort()).toEqual(['digest', 'id', 'images', 'layout', 'mermaid', 'modes'])
    expect(data.modes).toEqual(RUNTIME.modes)
  })

  it('is frozen all the way down, so one request cannot change what the next sees', () => {
    const data = themeDataOf(RUNTIME)
    expect(Object.isFrozen(data)).toBe(true)
    expect(Object.isFrozen(data.modes)).toBe(true)
    expect(Object.isFrozen(data.modes[0])).toBe(true)
    expect(Object.isFrozen(data.layout)).toBe(true)
    expect(() => {
      data.modes[0]!.id = 'night'
    }).toThrow(TypeError)
  })

  it('is a copy: freezing it does not freeze the parsed runtime', () => {
    themeDataOf(RUNTIME)
    expect(Object.isFrozen(RUNTIME.modes)).toBe(false)
  })
})

describe('themeMessagesOf', () => {
  it('gives the messages of every locale, frozen all the way down, as a copy', () => {
    const messages = themeMessagesOf(RUNTIME)
    expect(Object.keys(messages)).toEqual(['en'])
    expect(Object.isFrozen(messages)).toBe(true)
    expect(Object.isFrozen(messages.en)).toBe(true)
    expect(Object.isFrozen((messages.en as { hero: object }).hero)).toBe(true)
    expect(Object.isFrozen(RUNTIME.messages.en)).toBe(false)
  })
})
