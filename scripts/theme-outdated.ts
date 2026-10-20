// `npm run theme:outdated`: lists newer versions, compatible with this core, of the registry themes in themes.lock.json (#310).
import { fileURLToPath } from 'node:url'
import { createContext, outdatedThemes } from '../modules/theme/registry/commands'

const root = fileURLToPath(new URL('..', import.meta.url))

try {
  const rows = await outdatedThemes(createContext(root))
  for (const row of rows) process.stdout.write(`${row.id}: ${row.current} -> ${row.newer.join(', ')}\n`)
  if (rows.length === 0) process.stdout.write('Every locked theme is up to date.\n')
} catch (error) {
  process.stderr.write(`${(error as Error).message}\n`)
  process.exit(1)
}
