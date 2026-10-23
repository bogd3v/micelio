// Generates themes/theme.schema.json from the contract in modules/theme/contract.ts (ADR 0005, section 6), and
// themes/admission-report.schema.json from the admission report in modules/theme/admission/report.ts (#311).
// `npm run theme:schema` writes them; `npm run lint:schema` (part of `npm run lint`) fails when a file is out of date.
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { admissionReportJsonSchema } from '../modules/theme/admission/report'
import { themeJsonSchema } from '../modules/theme/contract'

const SCHEMAS = [
  { file: 'themes/theme.schema.json', source: 'modules/theme/contract.ts', schema: themeJsonSchema() },
  { file: 'themes/admission-report.schema.json', source: 'modules/theme/admission/report.ts', schema: admissionReportJsonSchema() },
]

let stale = false
for (const { file, source, schema } of SCHEMAS) {
  const path = fileURLToPath(new URL(`../${file}`, import.meta.url))
  const generated = `${JSON.stringify(schema, null, 2)}\n`
  if (process.argv.includes('--check')) {
    if (!existsSync(path) || readFileSync(path, 'utf8') !== generated) {
      process.stderr.write(`${file} is out of date with ${source}. Run \`npm run theme:schema\` and commit the result.\n`)
      stale = true
    } else process.stdout.write(`${file} is up to date\n`)
  } else {
    writeFileSync(path, generated)
    process.stdout.write(`${file} generated\n`)
  }
}
if (stale) process.exit(1)
