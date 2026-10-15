import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { buildOpenApiDocument, renderOpenApiDocument } from './document'
import type { RouteEntry } from './types'

const ROUTE_DIRECTORIES = ['server/api', 'server/routes']
const REGENERATE = 'Run `npm run openapi` and commit the result.'

/**
 * Compares the route files on disk with the manifest.
 *
 * @param root - The repository root.
 * @param routes - The route manifest.
 * @returns A message per route file with no entry and per entry with no file; empty when they match.
 */
export function routeManifestProblems(root: string, routes: RouteEntry[]): string[] {
  const onDisk = new Set(ROUTE_DIRECTORIES.flatMap(directory => routeFilesUnder(root, directory)))
  const listed = new Set(routes.map(route => route.file))
  return [
    ...[...onDisk].filter(file => !listed.has(file)).sort().map(file => `${file} has no entry in server/openapi/routes/`),
    ...[...listed].filter(file => !onDisk.has(file)).sort().map(file => `server/openapi/routes/ lists ${file}, which does not exist`),
  ]
}

/**
 * Everything `npm run lint:openapi` checks: the manifest against the route files, and the committed document against the generated one.
 *
 * @param root - The repository root.
 * @param file - The committed document, normally `docs/openapi.json`.
 * @param version - The version the document declares.
 * @param routes - The route manifest.
 * @returns The messages of what is wrong; empty when all is in step. A document that differs only in `info.version` says so, which is what a release bump leaves behind.
 */
export function openApiProblems(root: string, file: string, version: string, routes: RouteEntry[]): string[] {
  const problems = routeManifestProblems(root, routes)
  if (problems.length > 0) return [...problems, 'Update server/openapi/routes/ and run `npm run openapi`.']
  const generated = renderOpenApiDocument(buildOpenApiDocument(version, routes))
  if (!existsSync(file)) return [`${file} is missing. ${REGENERATE}`]
  const committed = readFileSync(file, 'utf8')
  if (committed === generated) return []
  const committedVersion = declaredVersion(committed)
  if (committedVersion !== undefined && committedVersion !== version && committed === renderOpenApiDocument(buildOpenApiDocument(committedVersion, routes))) {
    return [`docs/openapi.json declares info.version ${committedVersion} but package.json is ${version}; nothing else differs. ${REGENERATE}`]
  }
  return [`docs/openapi.json is out of date with server/openapi/ and server/schemas/. ${REGENERATE}`]
}

function routeFilesUnder(root: string, directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = `${directory}/${entry.name}`
    if (entry.isDirectory()) return routeFilesUnder(root, path)
    return /\.ts$/.test(entry.name) ? [path] : []
  })
}

function declaredVersion(text: string): string | undefined {
  try {
    return (JSON.parse(text) as { info?: { version?: string } }).info?.version
  } catch {
    // Not JSON: the caller reports the document as out of date
    return undefined
  }
}
