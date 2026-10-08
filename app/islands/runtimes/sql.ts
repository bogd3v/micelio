// SQL runtime of the playground: SQLite compiled to WebAssembly, in memory, one fresh database per run. The package finds its
// sqlite3.wasm next to itself, and the islands build emits it under /_islands/runtimes/ (modules/islands.ts).
import sqlite3InitModule from '@sqlite.org/sqlite-wasm'
import { splitStatements } from '../../helpers/sqlStatements'
import { cellLength, formatTable } from '../../helpers/sqlTable'
import type { SqlCell } from '../../helpers/sqlTable'
import type { Runtime, RunLimits } from './runtime'

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
// What `DB.prepare()` throws for a statement that is only whitespace or comments
const EMPTY_SQL = /empty SQL/i

export default async function load(): Promise<Runtime> {
  const sqlite3 = await sqlite3InitModule()
  const capi = sqlite3.capi as unknown as Record<string, unknown>
  const limit = sqlite3.capi.sqlite3_limit as unknown as (db: unknown, id: number, value: number) => number
  const complete = sqlite3.capi.sqlite3_complete as unknown as (sql: string) => number
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
    run(code: string, setup: string, limits: RunLimits): string {
      const db = new sqlite3.oo1.DB(':memory:', 'c')
      try {
        for (const [name, value] of Object.entries(LIMITS)) {
          if (typeof capi[name] === 'number') limit(db.pointer, capi[name], value)
        }
        if (setup.trim()) db.exec(setup)
        const sets: ResultSet[] = []
        let size = 0
        // One statement at a time (`exec` only reports rows of the first one that has columns): every statement with
        // columns is a result set, its header shown even when it returns no rows
        statements: for (const text of splitStatements(code, sql => complete(sql) === 1)) {
          let statement
          try {
            statement = db.prepare(text)
          } catch (error) {
            if (error instanceof Error && EMPTY_SQL.test(error.message)) continue
            throw error
          }
          try {
            if (!statement.columnCount) {
              while (statement.step()) {
                // A statement without columns has nothing to show
              }
              continue
            }
            const set: ResultSet = { columns: statement.getColumnNames([]), rows: [] }
            sets.push(set)
            size += 16
            while (statement.step()) {
              const cells = statement.get([]) as SqlCell[]
              set.rows.push(cells)
              size += cells.reduce<number>((sum, cell) => sum + cellLength(cell) + 3, 1)
              // Enough rows for the cap: a query that never ends stops here instead of filling memory
              if (size > limits.outputBytes * 2) break statements
            }
          } finally {
            statement.finalize()
          }
        }
        return sets.map(set => formatTable(set.columns, set.rows)).join('\n\n')
      } finally {
        db.close()
      }
    },
  }
}
