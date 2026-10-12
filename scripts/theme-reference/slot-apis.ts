// Builds docs/themes/reference/slot-apis.md from the TSDoc `@public` declarations of the slot APIs (ADR 0005, #426).
// It reads the syntax only (no type checker), so it needs no tsconfig and runs in milliseconds.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import ts from 'typescript'
import { SLOT_API_GROUPS } from '../../modules/theme/constants'
import type { SlotApiGroup } from '../../modules/theme/constants'

/** One documented `@public` declaration. */
export interface SlotApiDeclaration {
  name: string
  kind: 'function' | 'interface' | 'type' | 'enum' | 'class' | 'const'
  /** The declaration as written, without its body or doc comment. */
  signature: string
  summary: string
  params: { name: string, text: string }[]
  returns: string
  examples: string[]
  /** Whether the signature carries doc comments of its own (fields of an interface). */
  hasMemberDocs: boolean
}

/** The folders searched for public-tagged declarations that no group lists. */
const SCAN_DIRS = ['app', 'modules', 'server', 'themes']
const SCANNED_EXTENSIONS = ['.ts', '.mjs', '.vue']

interface JsDocHolder {
  jsDoc?: ts.JSDoc[]
}

const DECLARATION_KINDS: [(node: ts.Node) => boolean, SlotApiDeclaration['kind']][] = [
  [ts.isFunctionDeclaration, 'function'],
  [ts.isInterfaceDeclaration, 'interface'],
  [ts.isTypeAliasDeclaration, 'type'],
  [ts.isEnumDeclaration, 'enum'],
  [ts.isClassDeclaration, 'class'],
  [ts.isVariableStatement, 'const'],
]

function commentText(comment: string | ts.NodeArray<ts.JSDocComment> | undefined): string {
  return (ts.getTextOfJSDocComment(comment) ?? '').trim()
}

function nameOf(node: ts.Node, sf: ts.SourceFile): string {
  if (ts.isVariableStatement(node)) return node.declarationList.declarations.map(item => item.name.getText(sf)).join(', ')
  return (node as ts.NamedDeclaration).name?.getText(sf) ?? ''
}

function signatureOf(node: ts.Node, sf: ts.SourceFile): string {
  const start = node.getStart(sf)
  if (ts.isFunctionDeclaration(node) && node.body) return sf.text.slice(start, node.body.getStart(sf)).trim()
  if (ts.isVariableStatement(node)) {
    const declaration = node.declarationList.declarations[0]
    // A declared type says everything a reader needs; without one the initializer is the contract (`as const` lists)
    if (declaration?.type && declaration.initializer) return sf.text.slice(start, declaration.type.end).trim()
  }
  return node.getText(sf)
}

/**
 * The top-level declarations of a source file whose doc comment carries `@public`, in source order.
 *
 * @param fileName - Only used to parse; nothing is read from disk.
 * @param text - The source of the file.
 */
export function publicDeclarations(fileName: string, text: string): SlotApiDeclaration[] {
  const sf = ts.createSourceFile(fileName, text, ts.ScriptTarget.Latest, true)
  const found: SlotApiDeclaration[] = []
  for (const node of sf.statements) {
    const kind = DECLARATION_KINDS.find(([test]) => test(node))?.[1]
    const docs = (node as unknown as JsDocHolder).jsDoc
    if (!kind || !docs?.length) continue
    const tags = ts.getJSDocTags(node)
    if (!tags.some(tag => tag.tagName.text === 'public')) continue
    const signature = signatureOf(node, sf)
    found.push({
      name: nameOf(node, sf),
      kind,
      signature,
      summary: commentText(docs[docs.length - 1]!.comment),
      params: tags.filter(ts.isJSDocParameterTag).map(tag => ({ name: tag.name.getText(sf), text: commentText(tag.comment).replace(/^-\s*/, '') })),
      returns: commentText(tags.find(ts.isJSDocReturnTag)?.comment),
      examples: tags.filter(tag => tag.tagName.text === 'example').map(tag => commentText(tag.comment)),
      hasMemberDocs: signature.includes('/**'),
    })
  }
  return found
}

function tsFiles(dir: string): string[] {
  if (!existsSync(dir)) return []
  return readdirSync(dir).sort().flatMap((entry) => {
    const path = join(dir, entry)
    if (statSync(path).isDirectory()) return entry === 'node_modules' || entry.startsWith('.') ? [] : tsFiles(path)
    return SCANNED_EXTENSIONS.some(extension => path.endsWith(extension)) && !path.endsWith('.d.ts') ? [path] : []
  })
}

function filesOf(root: string, group: SlotApiGroup): string[] {
  const { dir } = group
  if (dir) return tsFiles(join(root, dir)).filter(path => path.endsWith('.ts') && relative(join(root, dir), path) !== 'index.ts').map(path => relative(root, path))
  return [...(group.files ?? [])]
}

/**
 * The `.ts`, `.mjs` and `.vue` files outside every group that mention `@public`: each is a slot API the record does not list, or a stray tag.
 *
 * @param root - The repository root.
 */
export function unlistedPublicFiles(root: string): string[] {
  const listed = new Set(SLOT_API_GROUPS.flatMap(group => filesOf(root, group)))
  return SCAN_DIRS
    .flatMap(dir => tsFiles(join(root, dir)).map(path => relative(root, path)))
    .filter(file => !listed.has(file) && readFileSync(join(root, file), 'utf8').includes('@public'))
}

function fence(code: string): string {
  return `\`\`\`ts\n${code}\n\`\`\``
}

function renderDeclaration(item: SlotApiDeclaration, compact: boolean): string {
  const parts = [`${compact ? '####' : '###'} \`${item.name}\``, item.summary]
  if (!compact || item.hasMemberDocs) parts.push(fence(item.signature))
  if (item.params.length) parts.push(item.params.map(param => `- \`${param.name}\`: ${param.text}`).join('\n'))
  if (item.returns) parts.push(`Returns: ${item.returns}`)
  parts.push(...item.examples)
  return parts.filter(Boolean).join('\n\n')
}

function renderTypes(sections: { file: string, items: SlotApiDeclaration[] }[]): string {
  return sections.map(({ file, items }) => {
    const rows = items.map(item => `| \`${item.name}\` | ${item.kind} | ${item.summary.replaceAll('|', '\\|').replaceAll('\n', ' ')} |`)
    const detailed = items.filter(item => item.hasMemberDocs).map(item => renderDeclaration(item, true))
    return [`### \`${file}\``, ['| Name | Kind | Summary |', '| --- | --- | --- |', ...rows].join('\n'), ...detailed].join('\n\n')
  }).join('\n\n')
}

/**
 * The groups of `SLOT_API_GROUPS` rendered as Markdown sections, read from the files under `root`.
 *
 * @throws `Error` when a listed file has no `@public` declaration, or a file outside the groups carries the tag.
 */
export function slotApiSections(root: string): string[] {
  const unlisted = unlistedPublicFiles(root)
  if (unlisted.length) throw new Error(`@public outside the slot API list (modules/theme/constants.ts, ADR 0005): ${unlisted.join(', ')}`)
  return SLOT_API_GROUPS.map((group) => {
    const sections = filesOf(root, group)
      .map(file => ({ file: file.replace(/^app\//, '~/').replace(/\.ts$/, '').replace(/\/index$/, ''), items: publicDeclarations(file, readFileSync(join(root, file), 'utf8')) }))
      .filter(section => section.items.length)
    if (!sections.length) throw new Error(`The slot API group "${group.title}" has no @public declaration`)
    const body = group.dir ? renderTypes(sections) : sections.flatMap(section => section.items.map(item => renderDeclaration(item, false))).join('\n\n')
    return `## ${group.title}\n\n${group.intro}\n\n${body}`
  })
}
