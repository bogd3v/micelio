/** A JSON Schema (draft 2020-12) object, narrowed only as far as `satisfiesSchema` reads it. */
export type JsonSchema = Record<string, unknown>

// Keywords that describe the schema and never constrain a value
const ANNOTATIONS = new Set(['$schema', '$defs', 'title', 'description'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function resolve(root: JsonSchema, ref: string): JsonSchema | undefined {
  const match = /^#\/\$defs\/(.+)$/.exec(ref)
  const target = match?.[1] === undefined ? undefined : (root.$defs as Record<string, unknown> | undefined)?.[match[1]]
  return isRecord(target) ? target : undefined
}

function hasType(type: unknown, value: unknown): boolean {
  switch (type) {
    case 'object': return isRecord(value)
    case 'array': return Array.isArray(value)
    case 'string': return typeof value === 'string'
    case 'number': return typeof value === 'number' && Number.isFinite(value)
    case 'integer': return typeof value === 'number' && Number.isInteger(value)
    case 'null': return value === null
    default: return false
  }
}

function check(schema: JsonSchema, value: unknown, root: JsonSchema): boolean {
  for (const [keyword, rule] of Object.entries(schema)) {
    if (ANNOTATIONS.has(keyword)) continue
    switch (keyword) {
      case '$ref': {
        const target = typeof rule === 'string' ? resolve(root, rule) : undefined
        if (!target || !check(target, value, root)) return false
        break
      }
      case 'anyOf':
        if (!Array.isArray(rule) || !rule.some(option => isRecord(option) && check(option, value, root))) return false
        break
      case 'type':
        if (!hasType(rule, value)) return false
        break
      case 'const':
        if (value !== rule) return false
        break
      case 'required':
        if (!isRecord(value) || !Array.isArray(rule) || !rule.every(name => typeof name === 'string' && name in value)) return false
        break
      case 'properties':
        // A property that is absent is `required`'s business; one that is present must match
        if (isRecord(value) && isRecord(rule)) {
          for (const [name, property] of Object.entries(rule)) {
            if (name in value && !(isRecord(property) && check(property, value[name], root))) return false
          }
        }
        break
      case 'items':
        if (Array.isArray(value) && !(isRecord(rule) && value.every(item => check(rule, item, root)))) return false
        break
      case 'minItems':
        if (Array.isArray(value) && !(typeof rule === 'number' && value.length >= rule)) return false
        break
      case 'minLength':
        if (typeof value === 'string' && !(typeof rule === 'number' && value.length >= rule)) return false
        break
      case 'exclusiveMinimum':
        if (typeof value === 'number' && !(typeof rule === 'number' && value > rule)) return false
        break
      case 'maximum':
        if (typeof value === 'number' && !(typeof rule === 'number' && value <= rule)) return false
        break
      default:
        // A keyword this validator does not know cannot be checked, so nothing passes
        return false
    }
  }
  return true
}

/**
 * Whether a value satisfies a JSON Schema.
 *
 * @remarks
 * Reads only the keywords the preview schema uses (`anyOf`, `$ref` to `#/$defs/…`, `type`, `const`, `required`, `properties`, `items`, `minItems`, `minLength`, `exclusiveMinimum` and `maximum`). A schema with any other keyword validates nothing, so a newer schema cannot be accepted by mistake: `test/jsonSchema.test.ts` checks it against zod's reading of the same schema. It exists so the preview frame needs no schema library in the browser (standard, principle 5).
 */
export function satisfiesSchema(schema: JsonSchema, value: unknown): boolean {
  return check(schema, value, schema)
}
