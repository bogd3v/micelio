// Characters handed to `complete` in total: linear SQL never gets near it
const SPLIT_BUDGET = 4_000_000

/**
 * Splits SQL into its statements, cutting only at a `;` that ends one as SQLite sees it: `complete` is `sqlite3_complete`,
 * so a `;` inside a string, a comment or a trigger body does not cut. Text after the last `;` is a statement of its own.
 */
export function splitStatements(sql: string, complete: (text: string) => boolean, budget = SPLIT_BUDGET): string[] {
  const statements: string[] = []
  let start = 0
  let checked = 0
  for (let index = sql.indexOf(';'); index !== -1; index = sql.indexOf(';', index + 1)) {
    // Many `;` inside a statement that never completes (an unclosed quote) make this quadratic: past the budget the rest
    // goes to SQLite whole, which reports the error instead of the run timing out
    checked += index + 1 - start
    if (checked > budget) break
    const candidate = sql.slice(start, index + 1)
    if (complete(candidate)) {
      statements.push(candidate)
      start = index + 1
    }
  }
  const rest = sql.slice(start)
  if (rest.trim()) statements.push(rest)
  return statements
}
