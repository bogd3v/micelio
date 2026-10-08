/** A value SQLite returns for a cell. */
export type SqlCell = string | number | bigint | boolean | Uint8Array | null

/** The text of one cell: `NULL` for null, the size for a blob. */
export function formatCell(value: SqlCell): string {
  if (value === null) return 'NULL'
  if (value instanceof Uint8Array) return `<blob ${value.byteLength} bytes>`
  return String(value).replace(/\r?\n/g, '\\n')
}

/** Characters `formatCell()` will show for a cell, without building a string from it (a blob can be megabytes). */
export function cellLength(value: SqlCell): number {
  if (value === null) return 4
  if (value instanceof Uint8Array) return 24
  return typeof value === 'string' ? value.length : 20
}

/** A result set as aligned text: the column names, a rule, then the rows (`a | b`, `--+--`). Trailing spaces are dropped. */
export function formatTable(columns: readonly string[], rows: readonly (readonly SqlCell[])[]): string {
  const cells = rows.map(row => row.map(formatCell))
  const widths = columns.map((name, index) => Math.max(name.length, ...cells.map(row => row[index]?.length ?? 0)))
  const line = (values: readonly string[]): string => values.map((value, index) => value.padEnd(widths[index] ?? 0)).join(' | ').trimEnd()
  return [line(columns), widths.map(width => '-'.repeat(width)).join('-+-'), ...cells.map(line)].join('\n')
}
