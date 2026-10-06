// Role CSS from a theme's theme.json. Plain ESM so the module, the CLI (scripts/build-tokens.mjs) and the tests share it.

import { OPTIONAL_ROLES, UNSAFE_VALUE } from './roles.mjs'

const NAME = /^[\w-]+$/
// Defense in depth: the contract validator (contract.ts) rejects the same values before the build gets here

function checkName(theme, kind, name) {
  if (typeof name !== 'string' || !NAME.test(name)) throw new Error(`Theme "${theme}": ${kind} "${name}" must match ^[\\w-]+$`)
}

function checkValue(theme, token, mode, value) {
  if (typeof value !== 'string') return
  // {name} references are resolved to var(--name) afterwards
  if (UNSAFE_VALUE.test(value.replace(/\{[\w-]+\}/g, ''))) {
    throw new Error(`Theme "${theme}": token "${token}"${mode ? ` in mode "${mode}"` : ''} has an unsafe value "${value}" (none of ; { } < > @ \` url( allowed)`)
  }
}

function resolveValue(value) {
  return typeof value === 'string' ? value.replace(/\{([\w-]+)\}/g, 'var(--$1)') : value
}

function valueFor(token, mode) {
  return resolveValue(typeof token.value === 'object' ? token.value[mode] : token.value)
}

/**
 * Role values for every mode of a theme (ADR 0005, sections 1 and 2).
 * `aliases` adds selectors per mode id: { noche: ['.dark'] }.
 */
export function buildTokensCss(data, aliases = {}) {
  const modes = data.modes ?? []
  if (!modes.length) throw new Error('theme.json declares no modes')
  const theme = data.id ?? 'unknown'
  modes.forEach(mode => checkName(theme, 'mode id', mode.id))
  const ids = modes.map(mode => mode.id)
  const unknown = Object.keys(aliases).filter(id => !ids.includes(id))
  if (unknown.length) throw new Error(`Unknown mode in --alias: ${unknown.join(', ')}`)

  const themed = [...data.color.tokens, ...(data.shadow?.tokens ?? [])]
  const flat = [...(data.spacing?.tokens ?? []), ...(data.radius?.tokens ?? []), ...(data.size?.tokens ?? []), ...(data.motion?.tokens ?? [])]

  for (const t of [...themed, ...flat]) {
    checkName(theme, 'token name', t.name)
    if (typeof t.value === 'object') ids.forEach(id => checkValue(theme, t.name, id, t.value[id]))
    else checkValue(theme, t.name, null, t.value)
    Object.entries(t.at ?? {}).forEach(([width, value]) => {
      checkValue(theme, t.name, null, width)
      checkValue(theme, t.name, null, value)
    })
  }
  const type = data.type ?? {}
  Object.entries(type.families ?? {}).forEach(([k, v]) => {
    checkName(theme, 'font family key', k)
    checkValue(theme, `font-${k}`, null, v)
  })
  ;(type.groups ?? []).forEach(g => g.styles.forEach((s) => {
    checkName(theme, 'type style', s.name)
    ;['fontSize', 'lineHeight', 'letterSpacing', 'fontWeight'].forEach(key => checkValue(theme, `text-${s.name}`, null, s[key] === undefined ? undefined : String(s[key])))
  }))

  const lines = [`/* ${String(data.name ?? data.id).replace(/[^\w .-]/g, '')} — generated from the theme's theme.json by modules/theme. Do not edit by hand. */`]
  modes.forEach((mode, i) => {
    const selectors = [...(i === 0 ? [':root'] : []), `[data-theme="${mode.id}"]`, ...(aliases[mode.id] ?? [])]
    lines.push(`${selectors.join(',\n')} {`)
    themed.forEach(t => lines.push(`  --${t.name}: ${valueFor(t, mode.id)};`))
    lines.push(`  color-scheme: ${mode.scheme};`, '}')
  })

  flat.forEach((t) => {
    if (typeof t.value === 'object') throw new Error(`Token ${t.name} has per-mode values but is not in the color or shadow group`)
  })
  themed.forEach((t) => {
    if (t.at) throw new Error(`Token ${t.name} uses "at", which only applies to single-value tokens`)
  })

  lines.push(':root {')
  flat.forEach(t => lines.push(`  --${t.name}: ${resolveValue(t.value)};`))
  // Optional roles a theme omits take the core default (ADR 0005, section 1)
  const declared = new Set(themed.map(t => t.name))
  Object.entries({ ...OPTIONAL_ROLES.color, ...OPTIONAL_ROLES.shadow }).forEach(([name, value]) => {
    if (!declared.has(name)) lines.push(`  --${name}: ${value};`)
  })
  Object.entries(data.type?.families ?? {}).forEach(([k, v]) => lines.push(`  --font-${k}: ${v};`))
  ;(data.type?.groups ?? []).forEach(g => g.styles.forEach((s) => {
    lines.push(`  --text-${s.name}: ${s.fontWeight} ${s.fontSize}/${s.lineHeight} var(--font-${g.family});`)
    lines.push(`  --tracking-${s.name}: ${s.letterSpacing ?? 'normal'};`)
  }))
  lines.push('}')

  // Roles that change with the viewport: { "at": { "<min-width>": "<value>" } }
  const responsive = flat.filter(t => t.at)
  const widths = [...new Set(responsive.flatMap(t => Object.keys(t.at)))].sort((a, b) => parseFloat(a) - parseFloat(b))
  widths.forEach((width) => {
    lines.push(`@media (min-width: ${width}) {`, '  :root {')
    responsive.filter(t => t.at[width]).forEach(t => lines.push(`    --${t.name}: ${resolveValue(t.at[width])};`))
    lines.push('  }', '}')
  })

  return lines.join('\n') + '\n'
}
