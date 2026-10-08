import { describe, expect, it } from 'vitest'
import { capOutput, fillLabel, formatDownload, isWorkerReply, MAX_OUTPUT_BYTES } from '../app/helpers/playgroundRunner'
import { cellLength, formatCell, formatTable } from '../app/helpers/sqlTable'
import { NETWORK_GLOBALS, removeNetworkGlobals } from '../app/helpers/workerSandbox'
import { runtimeDownloads, RUNTIME_FILES, UNUSED_RUNTIME_FILES } from '../app/helpers/playgroundRuntimes'

describe('capOutput', () => {
  it('keeps text under the cap as it is', () => {
    expect(capOutput('hello', 64)).toEqual({ text: 'hello', truncated: false })
    expect(capOutput('a'.repeat(64), 64)).toEqual({ text: 'a'.repeat(64), truncated: false })
  })

  it('cuts at the cap and says so', () => {
    const { text, truncated } = capOutput('a'.repeat(100), 64)
    expect(truncated).toBe(true)
    expect(text).toBe('a'.repeat(64))
  })

  it('counts bytes of UTF-8, not characters, and never cuts a character in half', () => {
    // "é" is two bytes: 33 of them are 66 bytes, so a 65-byte cap leaves 32
    const cut = capOutput('é'.repeat(33), 65)
    expect(cut.truncated).toBe(true)
    expect(cut.text).toBe('é'.repeat(32))
    expect(new TextEncoder().encode(cut.text).length).toBeLessThanOrEqual(65)
    // A four-byte emoji that straddles the cap goes whole
    expect(capOutput('ab😀', 4)).toEqual({ text: 'ab', truncated: true })
  })

  it('defaults to 64 KB', () => {
    expect(MAX_OUTPUT_BYTES).toBe(65536)
    expect(capOutput('x'.repeat(MAX_OUTPUT_BYTES)).truncated).toBe(false)
    expect(capOutput('x'.repeat(MAX_OUTPUT_BYTES + 1))).toEqual({ text: 'x'.repeat(MAX_OUTPUT_BYTES), truncated: true })
  })
})

describe('isWorkerReply', () => {
  it('accepts the three replies of the protocol', () => {
    expect(isWorkerReply({ type: 'started', id: 1 })).toBe(true)
    expect(isWorkerReply({ type: 'done', id: 1, output: '', truncated: false })).toBe(true)
    expect(isWorkerReply({ type: 'error', id: 1, message: 'x' })).toBe(true)
  })

  it('ignores anything else a Worker could post', () => {
    for (const value of [null, 'done', 3, {}, { type: 'done', id: '1', output: '', truncated: false }, { type: 'done', id: 1, output: 3, truncated: false }, { type: 'done', id: 1, output: '' }, { type: 'error', id: 1 }, { type: 'other', id: 1 }]) {
      expect(isWorkerReply(value), JSON.stringify(value)).toBe(false)
    }
  })
})

describe('labels', () => {
  it('formats a download in KB or MB', () => {
    expect(formatDownload(0.2)).toBe('1 KB')
    expect(formatDownload(640.4)).toBe('640 KB')
    expect(formatDownload(1126)).toBe('1.1 MB')
  })

  it('fills placeholders as text, once each, and leaves unknown ones', () => {
    expect(fillLabel('Run ({size}, {size}) {other}', { size: '1.1 MB' })).toBe('Run (1.1 MB, 1.1 MB) {other}')
    expect(fillLabel('Error: {message}', { message: '$& {size} $1' })).toBe('Error: $& {size} $1')
  })
})

describe('sql tables', () => {
  it('formats cells', () => {
    expect(formatCell(null)).toBe('NULL')
    expect(formatCell(12)).toBe('12')
    expect(formatCell(10n)).toBe('10')
    expect(formatCell('a\nb')).toBe('a\\nb')
    expect(formatCell(new Uint8Array(3))).toBe('<blob 3 bytes>')
  })

  it('measures a cell without building a string from it', () => {
    expect(cellLength(new Uint8Array(1_000_000))).toBe(24)
    expect(cellLength(null)).toBe(4)
    expect(cellLength('abc')).toBe(3)
    expect(cellLength(12345)).toBe(20)
  })

  it('aligns columns under their names', () => {
    expect(formatTable(['name', 'kind'], [['sqlite', 'database'], ['vite', 'bundler']])).toBe('name   | kind\n-------+---------\nsqlite | database\nvite   | bundler')
    expect(formatTable(['one'], [[1]])).toBe('one\n---\n1')
  })

  it('shows only the header of an empty result', () => {
    expect(formatTable(['a', 'b'], [])).toBe('a | b\n--+--')
  })
})

describe('removeNetworkGlobals', () => {
  it('removes own properties and inherited ones, and keeps the rest', () => {
    const proto = { fetch: () => 'network', other: 1 }
    const scope = Object.create(proto) as Record<string, unknown>
    scope.XMLHttpRequest = function XMLHttpRequest() {}
    scope.postMessage = () => {}
    const removed = removeNetworkGlobals(scope)
    expect(removed).toEqual(expect.arrayContaining(['fetch', 'XMLHttpRequest']))
    expect(scope.fetch).toBeUndefined()
    expect(proto.fetch).toBeUndefined()
    expect(scope.XMLHttpRequest).toBeUndefined()
    expect(typeof scope.postMessage).toBe('function')
    expect(scope.other).toBe(1)
  })

  it('blanks a property that cannot be deleted when it is still writable, and reports one that cannot be changed', () => {
    const scope: Record<string, unknown> = {}
    Object.defineProperty(scope, 'fetch', { value: () => 'network', configurable: false, writable: true })
    Object.defineProperty(scope, 'WebSocket', { value: function WebSocket() {}, configurable: false, writable: false })
    const removed = removeNetworkGlobals(scope)
    expect(removed).toContain('fetch')
    expect(scope.fetch).toBeUndefined()
    expect(removed).not.toContain('WebSocket')
  })

  it('removes the members of navigator that reach storage and the network', () => {
    const scope = { navigator: { storage: {}, locks: {}, serviceWorker: {}, sendBeacon: () => true, userAgent: 'x' } } as { navigator: Record<string, unknown> }
    removeNetworkGlobals(scope)
    expect(scope.navigator.storage).toBeUndefined()
    expect(scope.navigator.sendBeacon).toBeUndefined()
    expect(scope.navigator.userAgent).toBe('x')
  })

  it('names the globals a Worker uses to reach the network', () => {
    expect(NETWORK_GLOBALS).toEqual(expect.arrayContaining(['fetch', 'XMLHttpRequest', 'WebSocket', 'WebSocketStream', 'importScripts']))
  })
})

describe('runtime files', () => {
  const sizes = new Map([
    ['runtimes/sql-CLJSAl9U.js', 2048],
    ['runtimes/sqlite3-Con_VOcu.wasm', 3072],
    ['workers/playground-B4P1UfOh.js', 100],
    ['playground-CN2DwJsH.js', 100],
  ])

  it('adds up what a runtime downloads', () => {
    expect(runtimeDownloads(sizes).sql).toBe(5)
    expect(runtimeDownloads(new Map()).sql).toBe(0)
  })

  it('knows the files the SQLite package emits and nothing loads', () => {
    expect(UNUSED_RUNTIME_FILES.some(pattern => pattern.test('runtimes/sqlite3-opfs-async-proxy-Ck-yCayi.js'))).toBe(true)
    expect(UNUSED_RUNTIME_FILES.some(pattern => pattern.test('workers/sqlite3-worker1-B2BwHUJ2.js'))).toBe(true)
    expect(UNUSED_RUNTIME_FILES.some(pattern => pattern.test('runtimes/sql-CLJSAl9U.js'))).toBe(false)
    expect(RUNTIME_FILES.sql?.test('runtimes/sqlite3-opfs-async-proxy-Ck-yCayi.js')).toBe(false)
  })
})
