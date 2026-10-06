// `npm run theme:new -- <id> [--name "Name"]`: copies themes/starter/ to themes/<id>/ and renames it (docs/themes/creating-a-theme.md, section 1).
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { parseThemeNewArgs, scaffoldTheme } from '../modules/theme/scaffold'
import { discoverThemes, themeRoots } from '../modules/theme/themes'

const root = fileURLToPath(new URL('..', import.meta.url))

try {
  const { id, name } = parseThemeNewArgs(process.argv.slice(2))
  const installed = discoverThemes(themeRoots(root)).map(theme => theme.id)
  scaffoldTheme(join(root, 'themes', 'starter'), join(root, 'themes', id), id, installed, name)
  process.stdout.write(`Created themes/${id}/ from themes/starter/.

Note: font-fallbacks.css is the starter's (same font, Fraunces). To use another font, add a function for your
theme to scripts/perf/font-fallbacks.py or hand-tune the file (one "<Family> Fallback" face with size-adjust,
ascent-override and descent-override); its "generated" header no longer holds then. Never run
the script with --theme starter for your theme: it overwrites the starter's file.

Next steps:
  npm run theme:check -- ${id}
  NUXT_PUBLIC_THEME=${id} npm run dev     then open /_theme and review every mode
  Baselines come from CI, not from your machine (docs/theme-testing.md).
`)
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
