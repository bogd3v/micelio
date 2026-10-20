// `npm run theme:add -- <id>[@range]` or `npm run theme:add -- ./<id>-<version>.tgz`: verifies a package and records it in themes.lock.json (#310).
import { fileURLToPath } from 'node:url'
import { addTheme, createContext } from '../modules/theme/registry/commands'

const root = fileURLToPath(new URL('..', import.meta.url))
const spec = process.argv.slice(2).find(arg => !arg.startsWith('--'))

try {
  if (!spec) throw new Error('Usage: npm run theme:add -- <id>[@range] | ./<id>-<version>.tgz')
  await addTheme(createContext(root), spec)
  process.stdout.write('Next: npm run theme:pull\n')
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
