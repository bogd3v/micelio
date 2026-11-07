import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { readBlockMessage } from '../app/helpers/previewBlocks'
import { parsePreviewMessage } from './fixtures/plugin-contract/preview'

// The frame's reader against the plugin's schemas at the commit in fixtures/plugin-contract/PIN
// (docs/architecture/preview-contract.md). The contract decides what a message is; the frame reads
// the same messages by hand and must agree on each one.

const VERSION = '2026-11-06T10:00:00.000Z'
const address = { zone: 'sections', index: 2, block: 'hero', version: VERSION }

interface Case {
  name: string
  message: unknown
}

type Payload = Record<string, unknown>

function envelope(type: string, payload: unknown, extra: Payload = {}): unknown {
  return { v: 1, type, payload, ...extra }
}

function without(payload: Payload, key: string): Payload {
  const { [key]: _removed, ...rest } = payload
  return rest
}

function rename(payload: Payload, from: string, to: string): Payload {
  return { ...without(payload, from), [to]: payload[from] }
}

/** The valid payload of each message and the changes that break it, so every field is tried missing, renamed and of the wrong type. */
const MESSAGES: Record<string, { valid: Payload[], broken: Array<[string, Payload]> }> = {
  'micelio:select': {
    valid: [
      { address },
      { address: null },
      { address, item: 0 },
      { address, item: null },
      { address, item: 3, reveal: true },
      { address, reveal: false },
      { address, unknown: 'ignored' },
    ],
    broken: [
      ['no address', {}],
      ['address renamed', { addr: address }],
      ['address a string', { address: 'hero' }],
      ['address an array', { address: [address] }],
      ['zone missing', { address: without(address, 'zone') }],
      ['zone renamed', { address: rename(address, 'zone', 'area') }],
      ['zone not spoken', { address: { ...address, zone: 'blocks' } }],
      ['index missing', { address: without(address, 'index') }],
      ['index renamed', { address: rename(address, 'index', 'position') }],
      ['index a string', { address: { ...address, index: '2' } }],
      ['index negative', { address: { ...address, index: -1 } }],
      ['index fractional', { address: { ...address, index: 1.5 } }],
      ['block missing', { address: without(address, 'block') }],
      ['block renamed', { address: rename(address, 'block', 'id') }],
      ['block a number', { address: { ...address, block: 7 } }],
      ['block empty', { address: { ...address, block: '' } }],
      ['version missing', { address: without(address, 'version') }],
      ['version renamed', { address: rename(address, 'version', 'updatedAt') }],
      ['version a number', { address: { ...address, version: 1 } }],
      ['version empty', { address: { ...address, version: '' } }],
      ['reveal a string', { address, reveal: 'yes' }],
      ['reveal null', { address, reveal: null }],
      ['reveal a number', { address, reveal: 1 }],
      ['item a string', { address, item: '1' }],
      ['item negative', { address, item: -1 }],
      ['item fractional', { address, item: 0.5 }],
    ],
  },
  'micelio:hover': {
    valid: [{ address }, { address: null }, { address, item: 1 }, { address, item: null }],
    broken: [
      ['no address', {}],
      ['address renamed', { target: address }],
      ['address a number', { address: 4 }],
      ['index a string', { address: { ...address, index: 'two' } }],
      ['block renamed', { address: rename(address, 'block', 'name') }],
      ['version missing', { address: without(address, 'version') }],
      ['item a string', { address, item: 'a' }],
      ['item negative', { address, item: -2 }],
    ],
  },
  'micelio:insertGap': {
    valid: [
      { version: VERSION, zone: 'sections', after: 0, height: 80 },
      { version: VERSION, zone: 'sections', after: null, height: 120.5 },
      { version: VERSION, zone: 'sections', after: 4, height: 0 },
      { version: VERSION, zone: 'sections', after: 4, height: 2000 },
    ],
    broken: [
      ['version missing', { zone: 'sections', after: 0, height: 80 }],
      ['version renamed', { updatedAt: VERSION, zone: 'sections', after: 0, height: 80 }],
      ['version a number', { version: 3, zone: 'sections', after: 0, height: 80 }],
      ['version empty', { version: '', zone: 'sections', after: 0, height: 80 }],
      ['zone missing', { version: VERSION, after: 0, height: 80 }],
      ['zone renamed', { version: VERSION, area: 'sections', after: 0, height: 80 }],
      ['zone not spoken', { version: VERSION, zone: 'blocks', after: 0, height: 80 }],
      ['after missing', { version: VERSION, zone: 'sections', height: 80 }],
      ['after renamed', { version: VERSION, zone: 'sections', position: 0, height: 80 }],
      ['after a string', { version: VERSION, zone: 'sections', after: '0', height: 80 }],
      ['after negative', { version: VERSION, zone: 'sections', after: -1, height: 80 }],
      ['after fractional', { version: VERSION, zone: 'sections', after: 0.5, height: 80 }],
      ['height missing', { version: VERSION, zone: 'sections', after: 0 }],
      ['height renamed', { version: VERSION, zone: 'sections', after: 0, size: 80 }],
      ['height a string', { version: VERSION, zone: 'sections', after: 0, height: '80' }],
      ['height negative', { version: VERSION, zone: 'sections', after: 0, height: -1 }],
      ['height over the maximum', { version: VERSION, zone: 'sections', after: 0, height: 2001 }],
    ],
  },
  'micelio:patch': {
    valid: [
      { address, content: {}, items: [] },
      { address, content: { title: 'New', subtitle: null }, items: [] },
      { address, content: { title: 'New' }, items: [{ index: 0, content: { label: 'One' } }, { index: 2, content: { label: null } }] },
    ],
    broken: [
      ['no address', { content: {}, items: [] }],
      ['address renamed', { target: address, content: {}, items: [] }],
      ['address null', { address: null, content: {}, items: [] }],
      ['address index a string', { address: { ...address, index: '2' }, content: {}, items: [] }],
      ['address block missing', { address: without(address, 'block'), content: {}, items: [] }],
      ['content missing', { address, items: [] }],
      ['content renamed', { address, values: {}, items: [] }],
      ['content null', { address, content: null, items: [] }],
      ['content an array', { address, content: ['a'], items: [] }],
      ['content value a number', { address, content: { title: 4 }, items: [] }],
      ['content value a boolean', { address, content: { title: true }, items: [] }],
      ['content value an object', { address, content: { title: { text: 'a' } }, items: [] }],
      ['items missing', { address, content: { title: 'New' } }],
      ['items renamed', { address, content: {}, list: [] }],
      ['items null', { address, content: {}, items: null }],
      ['items an object', { address, content: {}, items: {} }],
      ['item index missing', { address, content: {}, items: [{ content: {} }] }],
      ['item index renamed', { address, content: {}, items: [{ position: 0, content: {} }] }],
      ['item index a string', { address, content: {}, items: [{ index: '0', content: {} }] }],
      ['item index negative', { address, content: {}, items: [{ index: -1, content: {} }] }],
      ['item content missing', { address, content: {}, items: [{ index: 0 }] }],
      ['item content renamed', { address, content: {}, items: [{ index: 0, values: {} }] }],
      ['item content value a number', { address, content: {}, items: [{ index: 0, content: { label: 1 } }] }],
    ],
  },
  'micelio:renderMode': {
    valid: [{ address, mode: 'dynamic' }, { address, mode: 'static' }],
    broken: [
      ['no address', { mode: 'static' }],
      ['address renamed', { target: address, mode: 'static' }],
      ['address null', { address: null, mode: 'static' }],
      ['address block empty', { address: { ...address, block: '' }, mode: 'static' }],
      ['mode missing', { address }],
      ['mode renamed', { address, renderMode: 'static' }],
      ['mode a boolean', { address, mode: true }],
      ['mode not a mode', { address, mode: 'hybrid' }],
      ['mode in another case', { address, mode: 'Static' }],
    ],
  },
}

/** The envelope faults that apply to any message: the frame ignores or drops them, and so does the contract. */
const ENVELOPES: Case[] = [
  { name: 'envelope version missing', message: { type: 'micelio:select', payload: { address: null } } },
  { name: 'envelope version renamed', message: { version: 1, type: 'micelio:select', payload: { address: null } } },
  { name: 'envelope version a string', message: { v: '1', type: 'micelio:select', payload: { address: null } } },
  { name: 'envelope version of a newer peer', message: { v: 2, type: 'micelio:select', payload: { address: null } } },
  { name: 'envelope type missing', message: { v: 1, payload: { address: null } } },
  { name: 'envelope type renamed', message: { v: 1, kind: 'micelio:select', payload: { address: null } } },
  { name: 'envelope type a number', message: { v: 1, type: 5, payload: { address: null } } },
  { name: 'envelope type empty', message: { v: 1, type: '', payload: { address: null } } },
  { name: 'envelope type unknown', message: { v: 1, type: 'micelio:unknown', payload: {} } },
  { name: 'envelope type in another case', message: { v: 1, type: 'micelio:Select', payload: { address: null } } },
  { name: 'envelope type a toString', message: { v: 1, type: 'toString', payload: {} } },
  { name: 'envelope payload missing', message: { v: 1, type: 'micelio:select' } },
  { name: 'envelope payload null', message: envelope('micelio:select', null) },
  { name: 'envelope payload a string', message: envelope('micelio:select', 'address') },
  { name: 'envelope payload an array', message: envelope('micelio:select', []) },
  { name: 'a string', message: 'micelio:select' },
  { name: 'null', message: null },
  { name: 'a number', message: 1 },
  { name: 'an array', message: [envelope('micelio:select', { address: null })] },
]

/**
 * Messages where the frame is stricter than the contract, or the two differ, and the reason. They are not in the sets above: the test reports them as differences, so a change on either side shows. None today.
 */
const KNOWN_DIFFERENCES: Array<{ name: string, message: unknown, contract: boolean, frame: boolean, why: string }> = []

function accepted(type: string, payload: Payload): Case {
  return { name: `${type} ${JSON.stringify(payload)}`, message: envelope(type, payload) }
}

const VALID: Case[] = Object.entries(MESSAGES).flatMap(([type, { valid }]) => valid.map(payload => accepted(type, payload)))
const REFUSED: Case[] = [
  ...Object.entries(MESSAGES).flatMap(([type, { broken }]) => broken.map(([why, payload]) => ({ name: `${type}: ${why}`, message: envelope(type, payload) }))),
  ...ENVELOPES,
]

/** What the frame makes of a message: `true` when it reads it as a request of its kind. */
function frameReads(message: unknown): boolean {
  const read = readBlockMessage(message, VERSION)
  return read !== undefined && read.kind !== 'malformed'
}

function contractReads(message: unknown): boolean {
  return parsePreviewMessage(message) !== undefined
}

describe('the preview contract at the pinned commit', () => {
  it('is the commit named in PIN', () => {
    const pin = readFileSync(new URL('./fixtures/plugin-contract/PIN', import.meta.url), 'utf8').trim()
    expect(pin).toMatch(/^[0-9a-f]{40}$/)
  })

  it('has a set of messages for each message the frame reads', () => {
    expect(Object.keys(MESSAGES).sort()).toEqual(['micelio:hover', 'micelio:insertGap', 'micelio:patch', 'micelio:renderMode', 'micelio:select'])
  })
})

describe('the frame and the contract', () => {
  it('the frame accepts every message the contract accepts', () => {
    expect(VALID.filter(({ message }) => !contractReads(message)).map(({ name }) => name), 'valid messages the contract refuses').toEqual([])
    expect(VALID.filter(({ message }) => !frameReads(message)).map(({ name }) => name), 'messages the contract accepts and the frame does not').toEqual([])
  })

  it('the frame refuses every message the contract refuses', () => {
    expect(REFUSED.filter(({ message }) => contractReads(message)).map(({ name }) => name), 'broken messages the contract accepts').toEqual([])
    expect(REFUSED.filter(({ message }) => frameReads(message)).map(({ name }) => name), 'messages the contract refuses and the frame does not').toEqual([])
  })

  it('names the messages where the two differ, so a change on either side shows', () => {
    for (const { name, message, contract, frame, why } of KNOWN_DIFFERENCES) {
      expect(contractReads(message), `the contract on ${name} (${why})`).toBe(contract)
      expect(frameReads(message), `the frame on ${name} (${why})`).toBe(frame)
    }
  })
})
