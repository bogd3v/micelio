// `npm run theme:prune -- --store <dir> [--built-in <dir>]`: removes from a deployment theme store what no image uses (#403).
import { isAbsolute, resolve } from 'node:path'
import { pruneDeploymentStore } from '../server/lib/themeSwitch/prune'

const args = process.argv.slice(2)
const value = (name: string): string | undefined => {
  const at = args.indexOf(name)
  return at === -1 ? undefined : args[at + 1]
}
const store = value('--store') ?? process.env.MICELIO_THEME_STORE
const builtIn = resolve(value('--built-in') ?? '.output/server/micelio/store')

if (!store || !isAbsolute(store)) {
  process.stderr.write('Usage: npm run theme:prune -- --store <absolute directory> [--built-in <built-in store of the build>]\n')
  process.exit(1)
}
try {
  const removed = await pruneDeploymentStore(store, builtIn)
  process.stdout.write(`Removed ${removed.entries.length} entries and ${removed.packages.length} packages.\n`)
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
