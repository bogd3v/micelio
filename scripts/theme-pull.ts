// `npm run theme:pull [-- --frozen]`: installs every theme of themes.lock.json into .micelio/themes/ (#310).
// --frozen fails when the lock is missing, not in its written form, unsatisfiable or out of step with a package; CI and the Dockerfile use it.
import { fileURLToPath } from 'node:url'
import { createContext, pullThemes } from '../modules/theme/registry/commands'

const root = fileURLToPath(new URL('..', import.meta.url))

try {
  const pulled = await pullThemes(createContext(root), { frozen: process.argv.includes('--frozen') })
  process.stdout.write(`${pulled.length} theme(s) installed in .micelio/themes/\n`)
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
