import { existsSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { contractProblems } from './contract'
import { checkCss, checkThemeCss } from './css-rules'
import { buildTokensCss } from './tokens.mjs'
import { SLOT_NAMES } from './data'
import { readThemeFile } from './files'
import { slotProblems } from './island'
import type { Hooks } from './hooks'
import type { InstalledTheme } from './themes'

// ADR 0005, section 6: every installed theme is validated before the build, and a failure names the theme and the problem

/** The role CSS the build generates from theme.json goes through the same CSS rules as the theme's own stylesheets. */
function generatedRolesProblems(theme: InstalledTheme, hooks: Hooks): string[] {
  try {
    return checkCss(buildTokensCss(theme.manifest), 'theme.json (generated role CSS)', { themeId: theme.id, themeDir: theme.dir, hooks }).problems
  } catch (error) {
    return [(error as Error).message]
  }
}

/** What the package itself must hold: referenced fonts, slot files that are slots, and CSS that follows the rules. */
function packageProblems(theme: InstalledTheme, hooks: Hooks): string[] {
  const { manifest, dir } = theme
  const problems: string[] = []
  for (const font of manifest.fonts ?? []) {
    if (!existsSync(join(dir, 'fonts', font.file))) problems.push(`font file "${font.file}" is not in fonts/`)
  }
  for (const [role, file] of Object.entries(manifest.images ?? {})) {
    if (!existsSync(join(dir, 'images', file))) problems.push(`images.${role}: "${file}" is not in images/`)
  }
  const slots: readonly string[] = SLOT_NAMES
  const slotsDir = join(dir, 'slots')
  if (existsSync(slotsDir)) {
    const options: Record<string, { island?: boolean } | undefined> = manifest.slots ?? {}
    for (const file of readdirSync(slotsDir).filter(file => file.endsWith('.vue'))) {
      const name = file.slice(0, -4)
      if (!slots.includes(name)) problems.push(`slots/${file} is not a slot; the slots are ${SLOT_NAMES.join(', ')}`)
      else {
        const source = readThemeFile(dir, join(slotsDir, file))
        problems.push(...('problem' in source ? [source.problem] : slotProblems(source.text, `slots/${file}`, Boolean(options[name]?.island))))
      }
    }
  }
  problems.push(...checkThemeCss({ themeId: manifest.id, themeDir: dir, hooks }))
  problems.push(...generatedRolesProblems(theme, hooks))
  return problems
}

/** Every problem of a theme, without its name; the package is checked only when theme.json is valid. */
export function themeProblems(theme: InstalledTheme, hooks: Hooks): string[] {
  const problems = contractProblems(theme.manifest)
  return problems.length ? problems : packageProblems(theme, hooks)
}

/** Throws one Error that lists, for each invalid theme, its name and every problem. */
export function validateThemes(themes: InstalledTheme[], hooks: Hooks): void {
  const lines = themes.flatMap(theme => themeProblems(theme, hooks).map(problem => `Theme "${theme.id}": ${problem}`))
  if (lines.length) throw new Error(`Invalid theme${lines.length > 1 ? 's' : ''} (contract v1, ADR 0005):\n${lines.join('\n')}`)
}
