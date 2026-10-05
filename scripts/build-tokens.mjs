#!/usr/bin/env node
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const DEFAULT_INPUT = fileURLToPath(new URL('../docs/design/tokens.json', import.meta.url))
const DEFAULT_OUTPUT = fileURLToPath(new URL('../app/assets/css/settings/tokens.css', import.meta.url))

function parseArgs(argv) {
  const opts = { check: false, aliases: {}, files: [] }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--check') {
      opts.check = true
    } else if (arg === '--alias') {
      const [theme, selector] = (argv[++i] ?? '').split('=')
      if (!theme || !selector) throw new Error('--alias expects <theme>=<selector>')
      ;(opts.aliases[theme] ??= []).push(selector)
    } else {
      opts.files.push(arg)
    }
  }
  return opts
}

function resolveValue(value) {
  return typeof value === 'string' ? value.replace(/\{([\w-]+)\}/g, 'var(--$1)') : value
}

function valueFor(token, theme) {
  return resolveValue(typeof token.value === 'object' ? token.value[theme] : token.value)
}

export function buildTokensCss(data, aliases = {}) {
  const themes = data.color.themes.map(t => t.id)
  const unknown = Object.keys(aliases).filter(theme => !themes.includes(theme))
  if (unknown.length) throw new Error(`Unknown theme in --alias: ${unknown.join(', ')}`)

  const themed = [...data.color.tokens, ...(data.shadow?.tokens ?? [])]
  const flat = [...(data.spacing?.tokens ?? []), ...(data.radius?.tokens ?? []), ...(data.layout?.tokens ?? [])]

  const lines = ['/* BogDev — generated from docs/design/tokens.json by scripts/build-tokens.mjs. Do not edit by hand. */']
  themes.forEach((theme, i) => {
    const selectors = [...(i === 0 ? [':root'] : []), `[data-theme="${theme}"]`, ...(aliases[theme] ?? [])]
    lines.push(`${selectors.join(',\n')} {`)
    themed.forEach(t => lines.push(`  --${t.name}: ${valueFor(t, theme)};`))
    lines.push(`  color-scheme: ${theme === 'dia' ? 'light' : 'dark'};`, '}')
  })

  lines.push(':root {')
  flat.forEach(t => lines.push(`  --${t.name}: ${t.value};`))
  Object.entries(data.type?.families ?? {}).forEach(([k, v]) => lines.push(`  --font-${k}: ${v};`))
  ;(data.type?.groups ?? []).forEach(g => g.styles.forEach((s) => {
    lines.push(`  --text-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${g.family});`)
  }))
  lines.push('}')

  ;(data.type?.groups ?? []).forEach(g => g.styles.forEach((s) => {
    lines.push(`.bd-${s.name} {`, `  font: var(--text-${s.name});`)
    if (s.letterSpacing) lines.push(`  letter-spacing: ${s.letterSpacing};`)
    lines.push('}')
  }))

  return lines.join('\n') + '\n'
}

function main() {
  const { check, aliases, files } = parseArgs(process.argv.slice(2))
  const input = files[0] ?? DEFAULT_INPUT
  const output = files[1] ?? DEFAULT_OUTPUT
  const css = buildTokensCss(JSON.parse(readFileSync(input, 'utf8')), aliases)

  if (check) {
    const current = existsSync(output) ? readFileSync(output, 'utf8') : ''
    if (current !== css) {
      process.stderr.write(`${output} is out of date. Run: npm run tokens\n`)
      process.exit(1)
    }
    process.stdout.write(`${output} is up to date\n`)
    return
  }

  writeFileSync(output, css)
  process.stdout.write(`${output} generated\n`)
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  main()
}
