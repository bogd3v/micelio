#!/usr/bin/env node
// Prints (or writes) the role CSS of a theme: node scripts/build-tokens.mjs [theme.json] [output.css] [--alias <mode>=<selector>]
// The build does this through modules/theme; this is for inspecting a theme's output.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { buildTokensCss } from '../modules/theme/tokens.mjs'

const DEFAULT_INPUT = fileURLToPath(new URL('../themes/bogota/theme.json', import.meta.url))

function parseArgs(argv) {
  const opts = { aliases: {}, files: [] }
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--alias') {
      const [mode, selector] = (argv[++i] ?? '').split('=')
      if (!mode || !selector) throw new Error('--alias expects <mode>=<selector>')
      ;(opts.aliases[mode] ??= []).push(selector)
    } else {
      opts.files.push(argv[i])
    }
  }
  return opts
}

const { aliases, files } = parseArgs(process.argv.slice(2))
const css = buildTokensCss(JSON.parse(readFileSync(files[0] ?? DEFAULT_INPUT, 'utf8')), aliases)
if (files[1]) {
  writeFileSync(files[1], css)
  process.stdout.write(`${files[1]} generated\n`)
} else {
  process.stdout.write(css)
}
