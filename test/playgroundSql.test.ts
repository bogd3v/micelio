import { describe, expect, it } from 'vitest'
import { splitStatements } from '../app/helpers/sqlStatements'
import load from '../app/islands/runtimes/sql'

const LIMITS = { deadlineMs: 4000, outputBytes: 64 * 1024 }

// A stand-in for sqlite3_complete: complete when quotes and BEGIN…END are balanced and the text ends with `;`
function complete(text: string): boolean {
  const quotes = (text.match(/'/g) ?? []).length
  const opened = (text.match(/\bBEGIN\b/gi) ?? []).length
  const closed = (text.match(/\bEND\b/gi) ?? []).length
  return quotes % 2 === 0 && opened === closed && /;\s*$/.test(text)
}

describe('splitStatements', () => {
  it('cuts at each statement end', () => {
    expect(splitStatements('SELECT 1; SELECT 2;', complete)).toEqual(['SELECT 1;', ' SELECT 2;'])
  })

  it('keeps a semicolon inside a string or a trigger body', () => {
    expect(splitStatements('SELECT \'a;b\'; SELECT 2;', complete)).toEqual(['SELECT \'a;b\';', ' SELECT 2;'])
    expect(splitStatements('CREATE TRIGGER t AFTER INSERT ON x BEGIN DELETE FROM y; END; SELECT 1;', complete))
      .toEqual(['CREATE TRIGGER t AFTER INSERT ON x BEGIN DELETE FROM y; END;', ' SELECT 1;'])
  })

  it('hands the rest over whole once the work budget is spent', () => {
    const sql = '\'' + ';'.repeat(10) + '; SELECT 1;'
    expect(splitStatements(sql, complete, 20)).toEqual([sql])
  })

  it('keeps text after the last semicolon and drops trailing whitespace', () => {
    expect(splitStatements('SELECT 1; SELECT 2', complete)).toEqual(['SELECT 1;', ' SELECT 2'])
    expect(splitStatements('SELECT 1;\n  ', complete)).toEqual(['SELECT 1;'])
    expect(splitStatements('', complete)).toEqual([])
  })
})

describe('SQL runtime', () => {
  it('shows the column headers of a query that returns no rows', async () => {
    const sql = await load()
    expect(sql.run('SELECT name, kind FROM tools WHERE false;', 'CREATE TABLE tools (name TEXT, kind TEXT);', LIMITS))
      .toBe('name | kind\n-----+-----')
  })

  it('shows one result set per statement with columns, and nothing for the others', async () => {
    const sql = await load()
    const output = sql.run('INSERT INTO t VALUES (1); SELECT a FROM t; SELECT \'x;y\' AS b;', 'CREATE TABLE t (a INTEGER);', LIMITS)
    expect(output).toBe('a\n-\n1\n\nb\n---\nx;y')
  })

  it('splits with SQLite\'s own rules: a trigger body keeps its semicolons', async () => {
    const sql = await load()
    const code = 'CREATE TRIGGER log AFTER INSERT ON t BEGIN INSERT INTO seen VALUES (new.a); END; INSERT INTO t VALUES (7); SELECT a FROM seen;'
    expect(sql.run(code, 'CREATE TABLE t (a INTEGER); CREATE TABLE seen (a INTEGER);', LIMITS)).toBe('a\n-\n7')
  })

  it('skips statements that are only comments and runs the text after the last semicolon', async () => {
    const sql = await load()
    expect(sql.run('-- a note\n;\nSELECT 2 AS n', '', LIMITS)).toBe('n\n-\n2')
  })

  it('still stops a query that never ends at the output cap', async () => {
    const sql = await load()
    const output = sql.run('WITH RECURSIVE n(i) AS (SELECT 1 UNION ALL SELECT i + 1 FROM n) SELECT i FROM n;', '', { ...LIMITS, outputBytes: 1024 })
    // The row estimate counts a number as 20 characters, so it stops early and well under twice the cap
    expect(output.startsWith('i\n--\n1\n2\n')).toBe(true)
    expect(output.length).toBeLessThan(2048)
  })

  it('reports the error of an unclosed quote among many semicolons instead of splitting for seconds', async () => {
    const sql = await load()
    const code = 'SELECT \'' + ';'.repeat(50_000)
    const started = performance.now()
    expect(() => sql.run(code, '', LIMITS)).toThrow()
    expect(performance.now() - started).toBeLessThan(2000)
  })

  it('reports an SQL error', async () => {
    const sql = await load()
    expect(() => sql.run('SELEC 1;', '', LIMITS)).toThrow(/syntax error/)
  })
})
