// `npm run theme:pack <id>`: packs an installed theme into .micelio/packages/<id>-<version>.tgz and its manifest (#309, ADR 0008 decision 1).
// The theme must pass what the build validates, `theme:check` and the pack metadata (version, license); exit 1 otherwise.
import { fileURLToPath } from 'node:url'
import { loadHooks } from '../modules/theme/hooks'
import { buildPackage, writePackage } from '../modules/theme/registry/build'
import { discoverThemes, themeRoots } from '../modules/theme/themes'

const root = fileURLToPath(new URL('..', import.meta.url))
const id = process.argv.slice(2).find(arg => !arg.startsWith('--'))

try {
  if (!id) throw new Error('Usage: npm run theme:pack -- <id>')
  const installed = discoverThemes(themeRoots(root))
  const theme = installed.find(candidate => candidate.id === id)
  if (!theme) throw new Error(`Theme "${id}" is not installed (installed: ${installed.map(candidate => candidate.id).join(', ') || 'none'})`)
  const built = buildPackage(theme, loadHooks(fileURLToPath(new URL('../app', import.meta.url))))
  const written = writePackage(built, root)
  process.stdout.write(`${built.tgzName}: ${built.tgz.length} bytes, ${built.manifest.files.length} files, ${built.manifest.size} bytes unpacked, code: ${built.manifest.code}\n`)
  process.stdout.write(`  digest ${built.digest}\n  ${written.tgz}\n  ${written.manifest}\n`)
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
