import { readFileSync, writeFileSync } from 'node:fs'
import { chromium } from '@playwright/test'

const DEFAULT_WIDTHS = [375, 800, 1280]
const THEME_STORAGE_KEY = 'micelio-theme'
const argv = process.argv.slice(2)

// Flags can appear anywhere; everything else is positional.
const options = { theme: null, scope: 'main', widths: DEFAULT_WIDTHS, states: false }
const [mode, ...args] = argv.filter((arg, index) => {
  const flag = /^--(theme|scope|widths|states)(?:=(.*))?$/.exec(arg)
  if (!flag) return true
  const value = flag[2] ?? (flag[1] === 'states' ? 'true' : argv[index + 1])
  if (flag[2] === undefined && flag[1] !== 'states') argv[index + 1] = '\0skip'
  if (flag[1] === 'widths') options.widths = value.split(',').map(Number)
  else if (flag[1] === 'states') options.states = true
  else options[flag[1]] = value
  return false
}).filter(arg => arg !== '\0skip')

// Computed styles of the page, optionally with the pseudo-elements that render.
// Styles are deduplicated in a table: entries are [label, styleId].
async function snapshot(page, scope, table) {
  const rows = await page.evaluate((scope) => {
    const names = Array.from(getComputedStyle(document.body)).sort()
    const read = (element, pseudo) => {
      const style = getComputedStyle(element, pseudo)
      return names.map(name => style.getPropertyValue(name))
    }
    const label = element => `${element.tagName.toLowerCase()}${element.id ? '#' + element.id : ''}${typeof element.className === 'string' && element.className ? '.' + element.className.trim().split(/\s+/).join('.') : ''}`
    const elements = scope === 'all'
      ? [document.documentElement, document.body, ...document.querySelectorAll('body *')]
      : Array.from(document.querySelectorAll('main *'))
    const out = []
    for (const element of elements) {
      out.push([label(element), read(element)])
      if (scope !== 'all') continue
      for (const pseudo of ['::before', '::after']) {
        const content = getComputedStyle(element, pseudo).content
        if (content && content !== 'none' && content !== 'normal') out.push([`${label(element)}${pseudo}`, read(element, pseudo)])
      }
      if (/^(input|textarea)$/i.test(element.tagName)) out.push([`${label(element)}::placeholder`, read(element, '::placeholder')])
    }
    return { names, out }
  }, scope)
  return rows.out.map(([label, values]) => {
    const style = Object.fromEntries(rows.names.map((name, index) => [name, values[index]]))
    const json = JSON.stringify(style)
    if (!table.index.has(json)) {
      table.index.set(json, table.styles.length)
      table.styles.push(style)
    }
    return [label, table.index.get(json)]
  })
}

async function capture(baseUrl, output, paths) {
  const result = {}
  const table = { styles: [], index: new Map() }
  const browser = await chromium.launch()
  for (const width of options.widths) {
    for (const path of paths) {
      const page = await browser.newPage({ viewport: { width, height: 900 } })
      if (options.theme) await page.addInitScript(([key, value]) => localStorage.setItem(key, value), [THEME_STORAGE_KEY, options.theme])
      await page.goto(baseUrl + path, { waitUntil: 'networkidle' })
      result[`${width} ${path}`] = await snapshot(page, options.scope, table)
      if (options.states) {
        await page.keyboard.press('Tab')
        result[`${width} ${path} [tab]`] = await snapshot(page, options.scope, table)
        await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
        await page.waitForTimeout(500)
        result[`${width} ${path} [scrolled]`] = await snapshot(page, options.scope, table)
      }
      await page.close()
    }
  }
  await browser.close()
  writeFileSync(output, JSON.stringify({ version: 2, theme: options.theme, scope: options.scope, styles: table.styles, pages: result }))
  console.log(`captured ${Object.values(result).reduce((total, list) => total + list.length, 0)} elements (${table.styles.length} distinct styles) into ${output}`)
}

// Reads both formats: version 1 (a list of style objects per page) and version 2.
function load(file) {
  const data = JSON.parse(readFileSync(file, 'utf8'))
  if (data.version !== 2) return Object.fromEntries(Object.entries(data).map(([key, list]) => [key, list.map(style => ['', style])]))
  return Object.fromEntries(Object.entries(data.pages).map(([key, list]) => [key, list.map(([label, id]) => [label, data.styles[id]])]))
}

function compare(beforeFile, afterFile) {
  const before = load(beforeFile)
  const after = load(afterFile)
  let differences = 0
  for (const [key, elements] of Object.entries(before)) {
    const other = after[key] ?? []
    if (elements.length !== other.length) console.log(`${key}: ${elements.length} elements before, ${other.length} after`)
    elements.forEach(([label, style], index) => {
      const changed = Object.keys(style).filter(name => style[name] !== other[index]?.[1]?.[name])
      if (changed.length) {
        differences++
        console.log(`${key} #${index} ${label}: ${changed.slice(0, 5).map(name => `${name} ${style[name]} -> ${other[index]?.[1]?.[name]}`).join(', ')}`)
      }
    })
  }
  console.log(`${differences} elements with different computed styles`)
  process.exitCode = differences ? 1 : 0
}

if (mode === 'capture') await capture(args[0], args[1], args.slice(2).length ? args.slice(2) : ['/', '/blog'])
else if (mode === 'compare') compare(args[0], args[1])
else console.log('usage: capture <baseUrl> <out.json> [paths...] [--theme noche|dia] [--scope main|all] [--widths 375,768,1280] [--states] | compare <before.json> <after.json>')
