import { describe, expect, it } from 'vitest'
import { OutputBuffer, readableTraceback } from '../app/helpers/pythonOutput'
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { dropPyodideCopies, pyodideAssets, stripLockFile } from '../modules/lib/pyodide-assets'

describe('OutputBuffer', () => {
  it('joins what was written, in order, partial lines included', () => {
    const buffer = new OutputBuffer(100)
    buffer.push('one\n')
    buffer.push('tw')
    buffer.push('o')
    expect(buffer.text()).toBe('one\ntwo')
  })

  it('stops storing past the limit, so a program that prints for ever cannot fill the memory', () => {
    const buffer = new OutputBuffer(10)
    for (let line = 0; line < 1000; line++) buffer.push('x'.repeat(5))
    expect(buffer.text().length).toBe(10)
  })

  it('stores only the part of a chunk that fits', () => {
    const buffer = new OutputBuffer(10)
    buffer.push('x'.repeat(1_000_000))
    expect(buffer.text()).toBe('x'.repeat(10))
  })

  it('starts again after clear()', () => {
    const buffer = new OutputBuffer(5)
    for (let line = 0; line < 10; line++) buffer.push('abc')
    buffer.clear()
    expect(buffer.text()).toBe('')
    buffer.push('ok')
    expect(buffer.text()).toBe('ok')
  })
})

describe('readableTraceback', () => {
  it('drops the frames of the interpreter above the reader\'s code', () => {
    const message = [
      'Traceback (most recent call last):',
      '  File "/lib/python314.zip/_pyodide/_base.py", line 599, in eval_code_async',
      '    await CodeRunner(',
      '  File "/lib/python314.zip/_pyodide/_base.py", line 412, in run_async',
      '    coroutine = eval(self.code, globals, locals)',
      '  File "<exec>", line 2, in <module>',
      'KeyError: \'missing\'',
      '',
    ].join('\n')
    expect(readableTraceback(message)).toBe('Traceback (most recent call last):\n  File "<exec>", line 2, in <module>\nKeyError: \'missing\'')
  })

  it('keeps the frames of the standard library below the reader\'s code', () => {
    const message = 'Traceback (most recent call last):\n  File "/lib/python314.zip/_pyodide/_base.py", line 1, in run\n    x\n  File "<exec>", line 3, in <module>\n  File "/lib/python314.zip/json/__init__.py", line 346, in loads\n    return decode(s)\nJSONDecodeError: boom'
    const text = readableTraceback(message)
    expect(text).not.toContain('_pyodide')
    expect(text).toContain('json/__init__.py')
  })

  it('leaves a message with no traceback as it is', () => {
    expect(readableTraceback('  SyntaxError: invalid syntax\n')).toBe('SyntaxError: invalid syntax')
  })
})

describe('stripLockFile', () => {
  it('keeps the info Pyodide checks and ships no packages', () => {
    const lock = JSON.stringify({ info: { version: '314.0.7', python: '3.14.0' }, packages: { numpy: { name: 'numpy' } } })
    expect(JSON.parse(stripLockFile(lock))).toEqual({ info: { version: '314.0.7', python: '3.14.0' }, packages: {} })
  })
})

describe('pyodideAssets', () => {
  it('emits the files only in a bundle that imports the virtual module', () => {
    const emitted: string[] = []
    const emitter = { emitFile: (file: { fileName: string }) => emitted.push(file.fileName) }
    const plugin = pyodideAssets()
    plugin.buildStart()
    plugin.generateBundle.call(emitter as never)
    expect(emitted).toEqual([])
    expect(plugin.load(plugin.resolveId('virtual:micelio-pyodide')!)).toMatch(/PYODIDE_DIR = "pyodide-[\w-]{8}"/)
    plugin.generateBundle.call(emitter as never)
    expect(emitted).toHaveLength(5)
    expect(emitted.every(name => /^runtimes\/pyodide-[\w-]{8}\//.test(name))).toBe(true)
  })
})

describe('dropPyodideCopies', () => {
  function site(): string {
    const dir = mkdtempSync(join(tmpdir(), 'micelio-pyodide-'))
    mkdirSync(join(dir, '_islands', 'runtimes', 'pyodide-abcdefgh'), { recursive: true })
    mkdirSync(join(dir, '_islands', 'runtimes', 'other'), { recursive: true })
    for (const file of ['pyodide.asm.wasm', 'pyodide.asm.wasm.br', 'pyodide.asm.wasm.gz']) writeFileSync(join(dir, '_islands', 'runtimes', 'pyodide-abcdefgh', file), 'x')
    writeFileSync(join(dir, '_islands', 'runtimes', 'other', 'a.js.gz'), 'x')
    return dir
  }

  it('keeps the brotli copy of a dynamic site and drops the gzip one', async () => {
    const dir = site()
    await dropPyodideCopies(dir, true)
    expect(readdirSync(join(dir, '_islands', 'runtimes', 'pyodide-abcdefgh')).sort()).toEqual(['pyodide.asm.wasm', 'pyodide.asm.wasm.br'])
    expect(readdirSync(join(dir, '_islands', 'runtimes', 'other'))).toEqual(['a.js.gz'])
    rmSync(dir, { recursive: true })
  })

  it('drops both in a static site', async () => {
    const dir = site()
    await dropPyodideCopies(dir, false)
    expect(readdirSync(join(dir, '_islands', 'runtimes', 'pyodide-abcdefgh'))).toEqual(['pyodide.asm.wasm'])
    rmSync(dir, { recursive: true })
  })
})
