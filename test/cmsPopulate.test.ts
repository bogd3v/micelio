import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ts from 'typescript'
import * as constants from '../server/lib/constants'

type Kind = 'relation' | 'media' | 'component' | 'dynamiczone' | 'scalar'

interface Attribute {
  kind: Kind
  /** The target content type of a relation, the component of a `component`, the components of a zone. */
  targets: string[]
}

type Attributes = Record<string, Attribute>

const DIR = 'test/fixtures/cms-schema/'

/** The content type a media attribute points at: its entry carries the fields of a file. */
const UPLOAD_FILE = 'plugin::upload.file'

/** The populate constants of `server/lib/constants.ts`, each with the content type it is walked from. */
const TABLE: Record<string, string> = {
  PAGE_POPULATE: 'api::page.page',
  DRAFT_PAGE_POPULATE: 'api::page.page',
  SITE_POPULATE: 'api::site-setting.site-setting',
  ABOUT_POPULATE: 'api::about.about',
  ARTICLE_POPULATE: 'api::article.article',
  FEED_POPULATE: 'api::article.article',
  POST_CARD_POPULATE: 'api::article.article',
}

function stringArgs(node: ts.TypeNode): string[] {
  if (ts.isLiteralTypeNode(node) && ts.isStringLiteral(node.literal)) return [node.literal.text]
  if (ts.isTupleTypeNode(node)) return node.elements.flatMap(stringArgs)
  return []
}

function kindOf(type: ts.TypeNode): Attribute {
  const parts = ts.isIntersectionTypeNode(type) ? type.types : [type]
  for (const part of parts) {
    if (!ts.isTypeReferenceNode(part)) continue
    const name = part.typeName.getText()
    const args = part.typeArguments ?? []
    if (name === 'Schema.Attribute.Relation') return { kind: 'relation', targets: args[1] ? stringArgs(args[1]) : [] }
    if (name === 'Schema.Attribute.Media') return { kind: 'media', targets: [UPLOAD_FILE] }
    if (name === 'Schema.Attribute.Component') return { kind: 'component', targets: args[0] ? stringArgs(args[0]) : [] }
    if (name === 'Schema.Attribute.DynamicZone') return { kind: 'dynamiczone', targets: args[0] ? stringArgs(args[0]) : [] }
  }
  return { kind: 'scalar', targets: [] }
}

/** Reads a generated types file: each schema (a content type or a component) by its uid, with its attributes. */
function readSchemas(file: string): Record<string, Attributes> {
  const source = ts.createSourceFile(file, readFileSync(DIR + file, 'utf8'), ts.ScriptTarget.Latest, true)
  const byInterface: Record<string, Attributes> = {}
  const uids: Record<string, string> = {}
  function visit(node: ts.Node): void {
    if (ts.isInterfaceDeclaration(node) && /^(ContentTypeSchemas|ComponentSchemas)$/.test(node.name.text)) {
      for (const member of node.members) {
        if (ts.isPropertySignature(member) && member.type && ts.isTypeReferenceNode(member.type)) {
          uids[member.type.typeName.getText()] = (member.name as ts.StringLiteral).text
        }
      }
    } else if (ts.isInterfaceDeclaration(node)) {
      const attributes: Attributes = {}
      for (const member of node.members) {
        if (!ts.isPropertySignature(member) || member.name.getText() !== 'attributes' || !member.type || !ts.isTypeLiteralNode(member.type)) continue
        for (const attribute of member.type.members) {
          if (ts.isPropertySignature(attribute) && attribute.type) attributes[attribute.name.getText()] = kindOf(attribute.type)
        }
      }
      byInterface[node.name.text] = attributes
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return Object.fromEntries(Object.entries(uids).map(([name, uid]) => [uid, byInterface[name] ?? {}]))
}

const SCHEMAS: Record<string, Attributes> = { ...readSchemas('contentTypes.d.ts'), ...readSchemas('components.d.ts') }

const POPULATABLE: Kind[] = ['relation', 'media', 'component', 'dynamiczone']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** One populate entry (`true` or an object with `fields`, `populate` and `on`) of `attribute`, named `uid` in the messages. */
function checkEntry(entry: unknown, attribute: Attribute, uid: string, path: string, failures: string[]): void {
  if (entry === true) return
  if (!isRecord(entry)) {
    failures.push(`${path}: an entry is true or an object`)
    return
  }
  for (const key of Object.keys(entry)) {
    if (!['fields', 'populate', 'on'].includes(key)) failures.push(`${path}.${key}: not a key the check knows (fields, populate, on)`)
  }
  if (entry.on !== undefined) {
    if (attribute.kind !== 'dynamiczone') failures.push(`${path}.on: ${uid} is not a dynamic zone`)
    else if (!isRecord(entry.on)) failures.push(`${path}.on: an object keyed by component`)
    else {
      for (const [name, inner] of Object.entries(entry.on)) {
        if (!attribute.targets.includes(name)) {
          failures.push(`${path}.on.${name}: not in the zone of ${uid}`)
          continue
        }
        checkEntry(inner, { kind: 'component', targets: [name] }, name, `${path}.on.${name}`, failures)
      }
    }
    return
  }
  if (attribute.kind === 'dynamiczone') {
    failures.push(`${path}: a dynamic zone is populated with \`on\``)
    return
  }
  const target = attribute.targets[0] ?? ''
  const attributes = SCHEMAS[target]
  if (!attributes) {
    failures.push(`${path}: ${target} is not in the schema`)
    return
  }
  if (entry.fields !== undefined) {
    if (!Array.isArray(entry.fields)) failures.push(`${path}.fields: an array of attribute names`)
    else {
      for (const name of entry.fields) {
        if (!(name in attributes)) failures.push(`${path}.fields.${name}: not an attribute of ${target}`)
      }
    }
  }
  if (entry.populate !== undefined) checkPopulate(entry.populate, target, `${path}.populate`, failures)
}

/** A `populate` value of the content type or component `uid`: `'*'`, `true` or an object keyed by attribute. */
function checkPopulate(populate: unknown, uid: string, path: string, failures: string[]): void {
  if (populate === '*' || populate === true) return
  if (!isRecord(populate)) {
    failures.push(`${path}: populate is '*', true or an object`)
    return
  }
  const attributes = SCHEMAS[uid]
  if (!attributes) {
    failures.push(`${path}: ${uid} is not in the schema`)
    return
  }
  const keys = Object.keys(populate)
  if (keys.includes('*') && keys.length > 1) failures.push(`${path}: '*' is mixed with keyed entries`)
  for (const key of keys) {
    if (key === '*') continue
    const attribute = attributes[key]
    if (!attribute || !POPULATABLE.includes(attribute.kind)) {
      failures.push(`${path}.${key}: not a relation, media, component or zone of ${uid}`)
      continue
    }
    checkEntry(populate[key], attribute, `${uid}.${key}`, `${path}.${key}`, failures)
  }
}

/** Walks `populate` from the content type `uid`; each failure names the path under `name`. */
function walk(name: string, populate: unknown, uid: string): string[] {
  const failures: string[] = []
  checkPopulate(populate, uid, name, failures)
  return failures
}

describe('the populate check', () => {
  it('every populate of the frontend names only what the CMS\'s schema has', () => {
    const constantsByName = constants as Record<string, unknown>
    const failures = Object.entries(TABLE).flatMap(([name, uid]) => walk(name, constantsByName[name], uid))
    expect(failures).toEqual([])
  })

  it('a populate that names a component its zone lacks fails and names the path', () => {
    const faulty = structuredClone(constants.PAGE_POPULATE)
    Object.assign(faulty.sections.on, { 'shared.playground': true })
    expect(walk('PAGE_POPULATE', faulty, 'api::page.page')).toEqual([
      'PAGE_POPULATE.sections.on.shared.playground: not in the zone of api::page.page.sections',
    ])
  })

  it('an unknown relation or field fails and names the path', () => {
    const faulty = structuredClone(constants.POST_CARD_POPULATE)
    faulty.category.fields.push('colour')
    Object.assign(faulty, { publisher: { fields: ['name'] }, title: true })
    expect(walk('POST_CARD_POPULATE', faulty, 'api::article.article')).toEqual([
      'POST_CARD_POPULATE.category.fields.colour: not an attribute of plugin::micelio.category',
      'POST_CARD_POPULATE.publisher: not a relation, media, component or zone of api::article.article',
      'POST_CARD_POPULATE.title: not a relation, media, component or zone of api::article.article',
    ])
  })

  it('a \'*\' mixed with keyed entries fails', () => {
    expect(walk('X', { '*': true, 'cover': true }, 'api::article.article')).toEqual(['X: \'*\' is mixed with keyed entries'])
  })

  it('a malformed `on` or `fields` fails', () => {
    expect(walk('X', { blocks: { on: ['shared.media'] }, category: { fields: 'name' } }, 'api::article.article')).toEqual([
      'X.blocks.on: an object keyed by component',
      'X.category.fields: an array of attribute names',
    ])
  })

  it('every exported populate constant is covered by the check', () => {
    const exported = Object.keys(constants).filter(name => name.endsWith('_POPULATE'))
    expect(exported.sort()).toEqual(Object.keys(TABLE).sort())
  })

  it('the fixture names a commit of micelio-cms in PIN', () => {
    expect(readFileSync(DIR + 'PIN', 'utf8').trim()).toMatch(/^[0-9a-f]{40}$/)
  })
})
