import { z } from 'zod'
import { QUOTED_VALUE, REQUIRED_ROLES, TYPE_FAMILIES, TYPE_STEPS, UNSAFE_VALUE } from './roles.mjs'
import type { RoleGroup } from './roles.mjs'
import { LAYOUT_REGIONS, SLOT_NAMES } from './data'
import { REGION_VARIANTS } from './layout/variants'

// Contract v1 (ADR 0005, section 6), defined once: the build validates every installed theme with it
// and `npm run theme:schema` generates themes/theme.schema.json from it.

export const CONTRACT_VERSION = 1
/** The init script stays under 2 KB (ADR 0004: it is inline on every page). */
export const MAX_MODES = 6
export const THEME_ID = /^[a-z0-9-]+$/
/** Ids no theme may take: its own `<id>-*` classes could not be told apart from the core's (ADR 0005, amendment of 2026-10-08). */
const RESERVED_THEME_IDS: readonly string[] = ['myc', 'micelio', 'bd']

/** Why `id` cannot be a theme id, or `null` when it can. `bd` stays reserved until the transition messages are removed (#422). */
export function themeIdProblem(id: string): string | null {
  if (!THEME_ID.test(id)) return `"id" must match ${THEME_ID}`
  if (id === 'bd') return '"id" "bd" is reserved: it was the core prefix before the rename to "myc", and stays reserved until the transition messages are removed'
  if (RESERVED_THEME_IDS.includes(id)) return `"id" "${id}" is reserved for the core: a theme's own classes (<id>-*) must not be confusable with the core's`
  return null
}
export const FONT_FILE = /^[\w.-]+\.woff2$/
const MODE_ID = /^[\w-]+$/
const NAME = /^[\w-]+$/

const THEMED_GROUPS: RoleGroup[] = ['color', 'shadow']
const FLAT_GROUPS: RoleGroup[] = ['spacing', 'radius', 'size', 'motion']

const Mode = z.object({
  id: z.string().regex(MODE_ID, { error: iss => `mode id "${String(iss.input)}" must match ^[\\w-]+$` }).describe('Goes into data-theme, CSS selectors and the bd-theme storage key.'),
  scheme: z.enum(['dark', 'light'], { error: iss => `has scheme "${String(iss.input)}", expected "dark" or "light"` }).describe('Lightness of the mode; core CSS selects on data-scheme.'),
  name: z.string().optional().describe('Label of the mode in the switch.'),
})

const Modes = z.array(Mode)
  .min(1, 'declares no modes')
  .max(MAX_MODES, `declares more than ${MAX_MODES} modes, at most ${MAX_MODES} (the init script must stay under 2 KB)`)
  .superRefine((modes, ctx) => {
    const seen = new Set<string>()
    for (const mode of modes) {
      if (seen.has(mode.id)) ctx.addIssue({ code: 'custom', message: `mode "${mode.id}" is declared twice` })
      seen.add(mode.id)
    }
  })
  .describe('The first mode is the theme default.')

const Font = z.object({
  family: z.string().min(1),
  file: z.string().regex(FONT_FILE, { error: iss => `font file "${String(iss.input)}" must match ${FONT_FILE}` }).describe('A woff2 file in the theme\'s fonts/ folder.'),
  preload: z.boolean().optional(),
})

const UNSAFE_HINT = 'none of ; { } < > @ ! \\ ` /* url( image-set( src( allowed'

/** A font stack: quotes allowed. */
const FontStack = z.string().refine(value => !UNSAFE_VALUE.test(value.replace(/\{[\w-]+\}/g, '')), {
  error: iss => `has an unsafe value "${String(iss.input)}" (${UNSAFE_HINT})`,
})

/** Any other role value: no quotes either. */
const RoleValue = FontStack.refine(value => !QUOTED_VALUE.test(value), {
  error: iss => `has a quoted value "${String(iss.input)}" (quotes are for font stacks only)`,
})

const Token = z.strictObject({
  name: z.string().regex(NAME, { error: iss => `token name "${String(iss.input)}" must match ^[\\w-]+$` }),
  value: z.union([RoleValue, z.record(z.string(), RoleValue)]).describe('A value, or one value per mode id (color and shadow groups only). `{name}` references another token.'),
  at: z.record(z.string(), RoleValue).optional().describe('Values from a min-width on (single-value tokens only).'),
  usage: z.string().optional(),
  contrast: z.array(z.strictObject({
    on: z.string().regex(NAME, { error: iss => `contrast "on" "${String(iss.input)}" must be a color role or token name` }).describe('A color role or token this one sits on.'),
    min: z.number().min(1).max(21).describe('Minimum WCAG contrast ratio on it, in every mode.'),
  })).optional().describe('Extra contrast assertions, checked by `npm run theme:check` on top of the contract\'s rule table.'),
})

const TokenGroup = z.strictObject({ note: z.string().optional(), tokens: z.array(Token) })

const TypeStyle = z.strictObject({
  name: z.string().regex(NAME),
  fontSize: z.string(),
  lineHeight: z.string(),
  fontWeight: z.number(),
  letterSpacing: z.string().optional(),
  usage: z.string().optional(),
  sample: z.string().optional(),
})

const Type = z.strictObject({
  families: z.record(z.string(), FontStack).describe(`Font stacks: ${TYPE_FAMILIES.join(', ')}.`),
  groups: z.array(z.strictObject({ name: z.string().optional(), family: z.string(), styles: z.array(TypeStyle) })),
})

const ImageFile = z.string().regex(/^[\w.-]+\.(png|jpe?g|webp|avif|gif|svg)$/i, { error: iss => `image "${String(iss.input)}" must be a png, jpg, webp, avif, gif or svg file name` })

const Images = z.strictObject({
  favicon: ImageFile.optional().describe('Default favicon, when the site settings have none.'),
  ogImage: ImageFile.optional().describe('Default share image of pages that have no cover.'),
  profile: ImageFile.optional().describe('Picture of the about profile block when the content has no photo.'),
})

const Slot = z.strictObject({ island: z.boolean({ error: 'must be true or false' }).optional().describe('True when the slot needs JavaScript (ADR 0005, section 12).') }, { error: 'must be an object such as { "island": true }' })

const Slots = z.strictObject(
  Object.fromEntries(SLOT_NAMES.map(name => [name, Slot.optional()])) as Record<typeof SLOT_NAMES[number], z.ZodOptional<typeof Slot>>,
  { error: iss => iss.code === 'unrecognized_keys' ? `declares the slot "${iss.keys.join('", "')}", which is not one of ${SLOT_NAMES.join(', ')}` : undefined },
)

const Layout = z.strictObject(
  Object.fromEntries(LAYOUT_REGIONS.map((region) => {
    const variants = REGION_VARIANTS[region].variants
    return [region, z.enum(variants as [string, ...string[]], { error: iss => `"${String(iss.input)}" is not a known variant; expected one of: ${variants.join(', ')}` }).optional()]
  })) as Record<typeof LAYOUT_REGIONS[number], z.ZodOptional<z.ZodEnum<{ [key: string]: string }>>>,
  { error: iss => iss.code === 'unrecognized_keys' ? `names the region "${iss.keys.join('", "')}", which is not one of ${LAYOUT_REGIONS.join(', ')}` : undefined },
)

/** Contract v1 as zod. Cross-field rules (roles per mode) are in the refinement at the end. */
export const ThemeSchema = z.strictObject({
  $schema: z.string().optional(),
  contract: z.literal(CONTRACT_VERSION, { error: iss => `declares contract ${JSON.stringify(iss.input)}, this build implements contract ${CONTRACT_VERSION}` }),
  id: z.string().regex(THEME_ID, { error: `"id" must match ${THEME_ID}` }).refine(id => !RESERVED_THEME_IDS.includes(id), { error: iss => themeIdProblem(String(iss.input)) ?? 'reserved id' }).describe('The folder name.'),
  name: z.string().optional(),
  modes: Modes,
  fonts: z.array(Font).optional(),
  images: Images.optional().describe('Files of images/ the core uses as defaults; they are served at /theme/images/.'),
  layout: Layout.optional().describe('Variant of each region; an omitted region uses the core default (the first variant).'),
  slots: Slots.optional().describe('Options of the closed list of slots; the component itself is slots/<Name>.vue.'),
  color: TokenGroup,
  shadow: TokenGroup,
  spacing: TokenGroup,
  radius: TokenGroup,
  size: TokenGroup,
  motion: TokenGroup,
  type: Type,
  mermaid: z.record(z.string(), z.string()).optional().describe('Overrides of Mermaid themeVariables, as roles.'),
  sections: z.record(z.string(), z.unknown()).optional().describe('Reserved for the section catalog (ADR 0005, section 11).'),
}).superRefine((theme, ctx) => {
  const problem = (message: string): void => ctx.addIssue({ code: 'custom', message })
  const modeIds = theme.modes.map(mode => mode.id)

  for (const group of [...THEMED_GROUPS, ...FLAT_GROUPS]) {
    const tokens = theme[group].tokens
    const names = new Set(tokens.map(token => token.name))
    for (const role of REQUIRED_ROLES[group]) {
      if (!names.has(role)) problem(`misses the role "${role}" in "${group}"`)
    }
    for (const token of tokens) {
      if (token.contrast && group !== 'color') problem(`${group} role "${token.name}" declares "contrast", which only color tokens allow`)
      const perMode = typeof token.value === 'object'
      if (THEMED_GROUPS.includes(group)) {
        if (token.at) problem(`${group} role "${token.name}" uses "at", which only applies to single-value roles`)
        if (!perMode) continue
        const values = token.value as Record<string, string>
        for (const id of modeIds) {
          if (!(id in values)) problem(`role "${token.name}" has no value for the mode "${id}"`)
        }
        for (const id of Object.keys(values)) {
          if (!modeIds.includes(id)) problem(`role "${token.name}" has a value for the mode "${id}", which the theme does not declare`)
        }
      } else if (perMode) {
        problem(`${group} role "${token.name}" has per-mode values, which only the color and shadow groups allow`)
      }
    }
  }

  for (const family of TYPE_FAMILIES) {
    if (!(family in theme.type.families)) problem(`misses the font family "${family}" in "type.families"`)
  }
  const steps = new Set(theme.type.groups.flatMap(group => group.styles.map(style => style.name)))
  for (const step of TYPE_STEPS) {
    if (!steps.has(step)) problem(`misses the type step "${step}" in "type.groups"`)
  }
  const families = new Set(Object.keys(theme.type.families))
  for (const group of theme.type.groups) {
    if (!families.has(group.family)) problem(`type group uses the family "${group.family}", which "type.families" does not declare`)
  }
})

export type ThemeContract = z.infer<typeof ThemeSchema>

function formatPath(path: ReadonlyArray<PropertyKey>): string {
  return path.map(String).join('.')
}

/** Every contract problem of a parsed theme.json, one line each (without the theme name). */
export function contractProblems(manifest: unknown): string[] {
  const result = ThemeSchema.safeParse(manifest)
  if (result.success) return []
  return result.error.issues.map((issue) => {
    const path = formatPath(issue.path)
    return path ? `${path}: ${issue.message}` : issue.message
  })
}

/** Throws one Error naming the theme and listing every problem. */
export function validateContract(manifest: unknown, fallbackName = 'unknown'): void {
  const problems = contractProblems(manifest)
  if (!problems.length) return
  const id = (manifest as { id?: unknown } | null)?.id
  const name = typeof id === 'string' ? id : fallbackName
  throw new Error(problems.map(problem => `Theme "${name}": ${problem}`).join('\n'))
}

/** The JSON Schema of theme.json, generated from the contract (themes/theme.schema.json). */
export function themeJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(ThemeSchema, { io: 'input', target: 'draft-2020-12', unrepresentable: 'any' }) as Record<string, unknown>
  return {
    ...schema,
    $id: 'https://github.com/bogd3v/micelio/blob/main/themes/theme.schema.json',
    title: 'Micelio theme.json (contract v1)',
  }
}
