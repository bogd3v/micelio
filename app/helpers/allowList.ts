/** A key to keep from an object, with the shape of its value. */
type FieldShapes = { readonly [key: string]: Shape }

/** An allow-list for one value: keep it whole (`true`) or rebuild it by `fields`, `each` or `variants`. */
export type Shape
  = | true
    | { readonly kind: 'fields', readonly fields: FieldShapes }
    | { readonly kind: 'each', readonly item: Shape }
    | { readonly kind: 'variants', readonly key: string, readonly cases: Readonly<Record<string, Shape>> }

/** An object of which only the listed keys are kept, each with its own shape. */
export function fields(shapes: FieldShapes): Shape {
  return { kind: 'fields', fields: shapes }
}

/** A list of which every entry follows `item`; an entry that does not fit is dropped. */
export function each(item: Shape): Shape {
  return { kind: 'each', item }
}

/** An object that follows the case named by its `key` value (a Strapi `__component`); an unknown case is dropped. */
export function variants(key: string, cases: Readonly<Record<string, Shape>>): Shape {
  return { kind: 'variants', key, cases }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Rebuilds `value` with only what `shape` allows, so a field a later version of the CMS adds never leaves the server.
 *
 * @remarks
 * `null` stays `null` and `undefined` stays absent. A value of the wrong kind (an object where a list is expected) is dropped, as are the keys the shape does not name. `true` keeps a value as it is, so use it for scalars and for data meant to pass whole, like JSON-LD.
 */
export function allow(value: unknown, shape: Shape): unknown {
  if (value === null || value === undefined) return value
  if (shape === true) return value
  if (shape.kind === 'each') {
    return Array.isArray(value) ? value.map(entry => allow(entry, shape.item)).filter(entry => entry !== undefined) : undefined
  }
  if (!isRecord(value)) return undefined
  if (shape.kind === 'variants') {
    const name = value[shape.key]
    const known = typeof name === 'string' && Object.hasOwn(shape.cases, name) ? shape.cases[name] : undefined
    return known ? allow(value, known) : undefined
  }
  const picked: Record<string, unknown> = {}
  for (const [key, fieldShape] of Object.entries(shape.fields)) {
    if (!Object.hasOwn(value, key)) continue
    const kept = allow(value[key], fieldShape)
    if (kept !== undefined) picked[key] = kept
  }
  return picked
}
