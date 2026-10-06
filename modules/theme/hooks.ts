import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

// The public hooks (ADR 0005, section 5) live in app/theme/hooks.json; the validator reads them here.

const Hook = z.union([
  z.string(),
  z.strictObject({
    describes: z.string(),
    layouts: z.record(z.string(), z.array(z.string())).optional(),
    states: z.array(z.string()).optional(),
    values: z.union([z.string(), z.array(z.string())]).optional(),
  }),
])

export const HooksSchema = z.strictObject({
  $comment: z.string().optional(),
  contract: z.literal(1),
  attributes: z.record(z.string().regex(/^data-[a-z-]+$/), Hook),
  classes: z.record(z.string().regex(/^bd-[a-z0-9-]+$/), Hook),
})

export interface Hooks {
  classes: ReadonlySet<string>
  attributes: ReadonlySet<string>
}

export function parseHooks(raw: unknown): Hooks {
  const hooks = HooksSchema.parse(raw)
  return { classes: new Set(Object.keys(hooks.classes)), attributes: new Set(Object.keys(hooks.attributes)) }
}

/** Hooks of the core: <srcDir>/theme/hooks.json. */
export function loadHooks(srcDir: string): Hooks {
  return parseHooks(JSON.parse(readFileSync(join(srcDir, 'theme/hooks.json'), 'utf8')))
}
