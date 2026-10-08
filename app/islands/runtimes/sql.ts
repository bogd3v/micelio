// SQL runtime of the playground: SQLite compiled to WebAssembly, in memory, one fresh database per run. The package finds its
// sqlite3.wasm next to itself, and the islands build emits it under /_islands/runtimes/ (modules/islands.ts).
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { MAX_OUTPUT_BYTES } from '../../helpers/playgroundRunner'
import { cellLength, formatTable } from '../../helpers/sqlTable'
import type { SqlCell } from '../../helpers/sqlTable'
import type { Runtime } from './runtime'

interface ResultSet {
  columns: string[]
  rows: SqlCell[][]
}

// What a query may allocate or build, by SQLite's own limits (sqlite3_limit): a `zeroblob(1e9)` or a `group_concat` over a
// recursive CTE fails with an error before the memory exists, instead of reaching the output cap
const LIMITS: Readonly<Record<string, number>> = {
  SQLITE_LIMIT_LENGTH: 1 << 20,
  SQLITE_LIMIT_SQL_LENGTH: 100_000,
  SQLITE_LIMIT_COLUMN: 100,
  SQLITE_LIMIT_EXPR_DEPTH: 100,
  SQLITE_LIMIT_COMPOUND_SELECT: 20,
  SQLITE_LIMIT_FUNCTION_ARG: 16,
  SQLITE_LIMIT_ATTACHED: 0,
  SQLITE_LIMIT_LIKE_PATTERN_LENGTH: 1000,
  SQLITE_LIMIT_VARIABLE_NUMBER: 100,
  SQLITE_LIMIT_TRIGGER_DEPTH: 10,
}
// All the engine may hold: tables built by a loop stop here with an error
const HEAP_LIMIT = 64 * 1024 * 1024

export default async function load(): Promise<Runtime> {
  const sqlite3 = await sqlite3InitModule()
  const capi = sqlite3.capi as unknown as Record<string, unknown>
  const limit = sqlite3.capi.sqlite3_limit as unknown as (db: unknown, id: number, value: number) => number
  // Not every build exports it
  if (typeof capi.sqlite3_hard_heap_limit64 === 'function') {
    const heap = capi.sqlite3_hard_heap_limit64 as (bytes: bigint | number) => unknown
    try {
      heap(BigInt(HEAP_LIMIT))
    } catch {
      heap(HEAP_LIMIT)
    }
  }
  return {
    run(code: string, setup: string): string {
      const db = new sqlite3.oo1.DB(':memory:', 'c')
      try {
        for (const [name, value] of Object.entries(LIMITS)) {
          if (typeof capi[name] === 'number') limit(db.pointer, capi[name], value)
        }
        if (setup.trim()) db.exec(setup)
        const sets: ResultSet[] = []
        let current: unknown
        let size = 0
        db.exec({
          sql: code,
          rowMode: 'stmt',
          callback: (statement) => {
            // A new statement starts a new result set
            if (statement !== current) {
              current = statement
              sets.push({ columns: statement.getColumnNames(), rows: [] })
              size += 16
            }
            const cells = statement.get([]) as SqlCell[]
            sets[sets.length - 1]!.rows.push(cells)
            size += cells.reduce<number>((sum, cell) => sum + cellLength(cell) + 3, 1)
            // Enough rows for the cap: a query that never ends stops here instead of filling memory
            if (size > MAX_OUTPUT_BYTES * 2) return false
          },
        })
        return sets.map(set => formatTable(set.columns, set.rows)).join('\n\n')
      } finally {
        db.close()
      }
    },
  }
}
