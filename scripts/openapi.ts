// Generates docs/openapi.json, the OpenAPI 3.1 document of the site API, from server/openapi/ and the zod schemas (standard, section 4).
// `npm run openapi` writes it; `npm run lint:openapi` (part of `npm run lint`) fails when the file is out of date or the route manifest
// does not match the route files. `--validate` also checks the generated document against the OpenAPI 3.1 specification.
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createJiti } from 'jiti'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const FILE = `${ROOT}docs/openapi.json`

// The server schemas import the app helpers with the `~` alias
const jiti = createJiti(import.meta.url, { alias: { '~': `${ROOT}app` } })
const { ROUTES, buildOpenApiDocument, openApiProblems, renderOpenApiDocument } = await jiti.import<typeof import('../server/openapi')>('../server/openapi')

const { version } = JSON.parse(readFileSync(`${ROOT}package.json`, 'utf8')) as { version: string }
const document = buildOpenApiDocument(version, ROUTES)
const generated = renderOpenApiDocument(document)

if (process.argv.includes('--validate')) {
  const { validate } = await import('@readme/openapi-parser')
  const result = await validate(JSON.parse(generated))
  if (!result.valid) {
    process.stderr.write(`docs/openapi.json is not valid OpenAPI 3.1:\n${JSON.stringify(result.errors, null, 2)}\n`)
    process.exit(1)
  }
}

if (process.argv.includes('--check')) {
  const problems = openApiProblems(ROOT, FILE, version, ROUTES)
  if (problems.length > 0) {
    process.stderr.write(`${problems.join('\n')}\n`)
    process.exit(1)
  }
  process.stdout.write('docs/openapi.json is up to date\n')
} else {
  writeFileSync(FILE, generated)
  process.stdout.write('docs/openapi.json generated\n')
}
