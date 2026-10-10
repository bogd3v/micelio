import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'
import type { Hooks } from './types'

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

/**
 * The shape of `app/theme/hooks.json`: the public `data-*` attributes and `myc-*` classes, each with what it describes.
 *
 * @remarks
 * `contract` must be `1`. A hook is a string, or an object with its `describes` text and the layouts, states and values it covers. `parseHooks` reads
 * the parsed file against it.
 */
export const HooksSchema = z.strictObject({
  $comment: z.string().optional(),
  contract: z.literal(1),
  attributes: z.record(z.string().regex(/^data-[a-z-]+$/), Hook),
  classes: z.record(z.string().regex(/^myc-[a-z0-9-]+$/), Hook),
})

/**
 * Reads the public hooks from a parsed `hooks.json`: its class names, the states written as classes, and its attributes.
 *
 * @param raw - The parsed JSON of `hooks.json`, not yet checked.
 * @throws `ZodError` when `raw` does not match `HooksSchema`.
 */
export function parseHooks(raw: unknown): Hooks {
  const hooks = HooksSchema.parse(raw)
  // A state that is a bare class ("myc-card-featured") is a hook too: it is documented as one
  const states = Object.values(hooks.classes).flatMap(hook => (typeof hook === 'string' ? [] : hook.states ?? [])).filter(state => /^myc-[a-z0-9-]+$/.test(state))
  return { classes: new Set([...Object.keys(hooks.classes), ...states]), attributes: new Set(Object.keys(hooks.attributes)) }
}

/** Hooks of the core: <srcDir>/theme/hooks.json. */
export function loadHooks(srcDir: string): Hooks {
  return parseHooks(JSON.parse(readFileSync(join(srcDir, 'theme/hooks.json'), 'utf8')))
}
