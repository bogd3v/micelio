// Generates themes/theme.schema.json from the contract in modules/theme/contract.ts (ADR 0005, section 6).
// `npm run theme:schema` writes it; `npm run lint:schema` (part of `npm run lint`) fails when the file is out of date.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { themeJsonSchema } from '../modules/theme/contract'

const FILE = fileURLToPath(new URL('../themes/theme.schema.json', import.meta.url))
const generated = `${JSON.stringify(themeJsonSchema(), null, 2)}\n`

if (process.argv.includes('--check')) {
  if (!existsSync(FILE) || readFileSync(FILE, 'utf8') !== generated) {
    process.stderr.write('themes/theme.schema.json is out of date with modules/theme/contract.ts. Run `npm run theme:schema` and commit the result.\n')
    process.exit(1)
  }
  process.stdout.write('themes/theme.schema.json is up to date\n')
} else {
  writeFileSync(FILE, generated)
  process.stdout.write('themes/theme.schema.json generated\n')
}
