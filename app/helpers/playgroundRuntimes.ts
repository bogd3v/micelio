// Files of /_islands/ that a playground runtime downloads when Run is pressed (modules/islands.ts sums their size for the Save-Data label).
// A new runtime adds its pattern here.
export const RUNTIME_FILES: Readonly<Record<string, RegExp>> = {
  sql: /^runtimes\/(?:sql|sqlite3)-[\w-]{8}\.(?:js|wasm)$/,
  // The runtime, QuickJS's loader chunks (`ffi`, `module-*`, `emscripten-module.browser`) and its WebAssembly
  javascript: /^runtimes\/(?:javascript|ffi|module-[\w]+|emscripten-module(?:\.browser)?)-[\w-]+\.(?:js|wasm)$/,
  // The chunk of the runtime and the Pyodide folder it loads (modules/lib/pyodide-assets.ts)
  python: /^runtimes\/(?:python-[\w-]{8}\.js|pyodide-[\w-]{8}\/(?:pyodide\.mjs|pyodide\.asm\.mjs|pyodide\.asm\.wasm|python_stdlib\.zip|pyodide-lock\.json))$/,
}

// Emitted by the SQLite package next to what we use, never loaded: its OPFS proxy and its worker1 API (we run in memory, in our own Worker)
export const UNUSED_RUNTIME_FILES: readonly RegExp[] = [
  /^runtimes\/sqlite3-opfs-async-proxy-[\w-]+\.js$/,
  /^workers\/sqlite3-worker1-[\w-]+\.js$/,
]

/** Runtime id -> kilobytes of the files of `sizes` (relative path -> bytes) it downloads. */
export function runtimeDownloads(sizes: ReadonlyMap<string, number>): Record<string, number> {
  return Object.fromEntries(Object.entries(RUNTIME_FILES).map(([runtime, pattern]) => {
    const bytes = [...sizes].filter(([file]) => pattern.test(file)).reduce((sum, [, size]) => sum + size, 0)
    return [runtime, Math.round(bytes / 1024)]
  }))
}
