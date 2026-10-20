import { z } from 'zod'
import { LAYOUT_REGIONS, SLOT_NAMES, THEME_ID, THEME_VERSION, VERSION_MAX_LENGTH } from '../constants'
import { THEME_DIGEST } from '../registry/constants'
import { COMPILED_DIGEST } from './constants'
import type { RuntimeData } from './types'

// Every value of runtime.json that can reach HTML, a header or a path is re-derived here, whatever the compiler wrote (ADR 0009, section 6).

const IDENT = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const FONT_FILE_NAME = /^[\w.-]{1,100}\.woff2$/
const IMAGE_PATH = /^[\w.-]{1,100}(?:\/[\w.-]{1,100}){0,7}$/
const COLOR = /^#[0-9a-f]{6}$/
const hasControl = (value: string): boolean => [...value].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127)
const TEXT = z.string().max(200).refine(value => !hasControl(value) && !/[<>]/.test(value), 'contains a control character or a tag')
const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype'])
const MAX_AST_DEPTH = 32
const MAX_AST_NODES = 20_000
const AST_KEYS = new Set(['t', 'b', 'c', 'i', 'v', 'k', 'm', 's', 'l', 'n'])
const LAST_NODE_TYPE = 9

function astNode(value: unknown, depth: number, budget: { nodes: number }): string | null {
  if (depth > MAX_AST_DEPTH || ++budget.nodes > MAX_AST_NODES) return 'is too large'
  if (Array.isArray(value)) {
    for (const item of value) {
      const problem = astNode(item, depth + 1, budget)
      if (problem) return problem
    }
    return null
  }
  if (typeof value !== 'object' || value === null) return 'holds a value that is not a node'
  const node = value as Record<string, unknown>
  if (!Number.isInteger(node.t) || (node.t as number) < 0 || (node.t as number) > LAST_NODE_TYPE) return 'holds a node of an unknown type'
  for (const [key, child] of Object.entries(node)) {
    if (!AST_KEYS.has(key)) return `holds a node with the key "${key}"`
    if (typeof child === 'object' && child !== null) {
      const problem = astNode(child, depth + 1, budget)
      if (problem) return problem
    } else if (typeof child !== 'string' && typeof child !== 'number') return 'holds a value that is not a node'
  }
  return null
}

function messageTree(value: unknown, depth: number, budget: { nodes: number }): string | null {
  if (depth > MAX_AST_DEPTH || typeof value !== 'object' || value === null || Array.isArray(value)) return 'is not a tree of messages'
  for (const [key, child] of Object.entries(value)) {
    if (FORBIDDEN_KEYS.has(key)) return `has the key "${key}"`
    const isNode = typeof child === 'object' && child !== null && typeof (child as { t?: unknown }).t === 'number'
    const problem = isNode ? astNode(child, depth + 1, budget) : messageTree(child, depth + 1, budget)
    if (problem) return problem
  }
  return null
}

const Messages = z.record(z.string().regex(/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})?$/), z.unknown().superRefine((value, ctx) => {
  const problem = messageTree(value, 0, { nodes: 0 })
  if (problem) ctx.addIssue({ code: 'custom', message: `messages ${problem}` })
}))

const Mode = z.strictObject({ id: z.string().regex(IDENT).max(32), scheme: z.enum(['dark', 'light']), name: TEXT.optional() })
const Palette = z.strictObject({
  scheme: z.enum(['dark', 'light']),
  ...Object.fromEntries(['surface', 'surface-raised', 'surface-sunken', 'ink', 'on-ink', 'accent', 'accent-soft', 'accent-hover', 'on-accent', 'link-soft'].map(role => [role, z.string().regex(COLOR)])),
  linkIsAccent: z.boolean(),
  focusIsAccent: z.boolean(),
  linkSoftIsAccentSoft: z.boolean(),
  linkSoftIsDefault: z.boolean(),
}) as unknown as z.ZodType<RuntimeData['palette']['modes'][string]>

function schema(): z.ZodType<RuntimeData> {
  return z.strictObject({
    id: z.string().regex(THEME_ID),
    name: TEXT.optional(),
    version: z.string().max(VERSION_MAX_LENGTH).regex(THEME_VERSION).optional(),
    digest: z.string().regex(COMPILED_DIGEST),
    packageDigest: z.string().regex(THEME_DIGEST),
    contract: z.string().regex(/^\d+\.\d+$/),
    code: z.boolean(),
    modes: z.array(Mode).min(1).max(6),
    fonts: z.array(z.strictObject({ family: TEXT, file: z.string().regex(FONT_FILE_NAME), preload: z.boolean().optional(), url: z.string() })).max(20),
    images: z.strictObject({ favicon: z.string().optional(), ogImage: z.string().optional(), profile: z.string().optional() }),
    layout: z.strictObject(Object.fromEntries(LAYOUT_REGIONS.map(region => [region, z.string().regex(IDENT)]))),
    slots: z.strictObject(Object.fromEntries(SLOT_NAMES.map(name => [name, z.strictObject({ island: z.boolean().optional() }).optional()]))),
    mermaid: z.record(z.string().max(64), TEXT),
    display: z.strictObject({ family: TEXT, file: z.string().regex(FONT_FILE_NAME).optional(), sharedWithSans: z.boolean(), display: TEXT, sans: TEXT }),
    palette: z.strictObject({
      modes: z.record(z.string().regex(IDENT), Palette),
      rules: z.array(z.strictObject({ role: z.string().regex(IDENT), surfaces: z.array(z.string().regex(IDENT)).max(10), min: z.number().min(1).max(21) })).max(50),
    }),
    messages: Messages,
  }).superRefine((data, ctx) => {
    const base = `/_t/${data.digest}`
    const own = (url: string, folder: string, pattern: RegExp): boolean => url.startsWith(`${base}/${folder}/`) && pattern.test(url.slice(base.length + folder.length + 2))
    for (const font of data.fonts) if (font.url !== `${base}/fonts/${font.file}`) ctx.addIssue({ code: 'custom', message: `the URL of font "${font.file}" is not under the theme's own fonts/` })
    for (const [role, url] of Object.entries(data.images)) if (!own(url, 'images', IMAGE_PATH) || url.split('/').some(segment => segment === '..' || segment === '.')) ctx.addIssue({ code: 'custom', message: `the URL of image "${role}" is not under the theme's own images/` })
  }) as unknown as z.ZodType<RuntimeData>
}

/**
 * Parses the `runtime.json` of an entry that already verified against its manifest, re-deriving every value that can reach HTML.
 *
 * @remarks
 * Ids and modes are held to the grammar of the contract, font and image URLs to the entry's own `/_t/<digest>/` folders, text
 * to short strings with no control characters or tags, and the message trees to the AST node types of the message compiler with
 * no prototype keys and a size cap. The entry's own digest must match the one it was loaded under.
 *
 * @param expectedDigest - The entry digest the file was loaded under.
 * @throws `Error` naming the first problem, without a path or the offending value.
 */
export function parseRuntime(data: Uint8Array, expectedDigest: string): RuntimeData {
  let raw: unknown
  try {
    raw = JSON.parse(Buffer.from(data).toString('utf8'))
  } catch {
    throw new Error('runtime.json is not valid JSON')
  }
  const parsed = schema().safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new Error(`runtime.json: ${issue?.path.join('.') || 'the file'}: ${issue?.message ?? 'is invalid'}`)
  }
  if (parsed.data.digest !== expectedDigest) throw new Error('runtime.json is for another entry')
  return parsed.data
}
