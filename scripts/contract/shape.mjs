// Compares the shape of two JSON responses (keys and types, never values). Pure; unit-tested in test/contractShape.test.ts.
// Used by e2e/contract/mock-shape.spec.ts to check the mock Strapi against the real CMS.

/**
 * The shape of a JSON value. Arrays and repeated objects are merged into one: the union of their keys, with the kinds each key took.
 * @returns {{ kinds: string[], fields?: Record<string, object>, items?: object, components?: Record<string, object> }}
 */
export function shapeOf(value) {
  if (value === null || value === undefined) return { kinds: ['null'] }
  if (Array.isArray(value)) {
    // A Strapi dynamic zone: one shape per component, since each has its own fields
    if (value.length && value.every(isComponent)) {
      const components = {}
      for (const entry of value) components[entry.__component] = components[entry.__component] ? mergeShapes(components[entry.__component], shapeOf(entry)) : shapeOf(entry)
      return { kinds: ['array'], components }
    }
    const items = value.map(shapeOf).reduce((merged, shape) => (merged ? mergeShapes(merged, shape) : shape), null)
    return { kinds: ['array'], ...(items ? { items } : {}) }
  }
  if (typeof value === 'object') {
    return { kinds: ['object'], fields: Object.fromEntries(Object.entries(value).map(([key, field]) => [key, shapeOf(field)])) }
  }
  return { kinds: [typeof value] }
}

function isComponent(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value) && typeof value.__component === 'string'
}

function mergeShapes(a, b) {
  const merged = { kinds: [...new Set([...a.kinds, ...b.kinds])] }
  if (a.fields || b.fields) {
    const fields = { ...(a.fields ?? {}) }
    for (const [key, shape] of Object.entries(b.fields ?? {})) fields[key] = fields[key] ? mergeShapes(fields[key], shape) : shape
    merged.fields = fields
  }
  if (a.items || b.items) merged.items = a.items && b.items ? mergeShapes(a.items, b.items) : (a.items ?? b.items)
  if (a.components || b.components) {
    const components = { ...(a.components ?? {}) }
    for (const [name, shape] of Object.entries(b.components ?? {})) components[name] = components[name] ? mergeShapes(components[name], shape) : shape
    merged.components = components
  }
  return merged
}

/**
 * What the mock answers that the real CMS does not: a key the CMS does not have, or a type it does not use. The other direction (the CMS
 * answers more than the mock) is not an issue: the mock is a simplification. A null on either side says nothing about the type, and an
 * empty array has no items to compare. The entries of a dynamic zone are compared by `__component`, and only those the CMS answered.
 * @param mock - `shapeOf` the mock's answer.
 * @param real - `shapeOf` the CMS's answer to the same request.
 * @param path - The location of these shapes in the answer, for the messages.
 * @returns One message per difference, each naming the path of the key.
 */
export function mockIssues(mock, real, path = '$') {
  const mockKinds = mock.kinds.filter(kind => kind !== 'null')
  const realKinds = real.kinds.filter(kind => kind !== 'null')
  if (!mockKinds.length || !realKinds.length) return []
  const wrong = mockKinds.filter(kind => !realKinds.includes(kind))
  if (wrong.length) return [`${path}: the mock has ${wrong.join('|')}, the CMS has ${realKinds.join('|')}`]
  const issues = []
  for (const [key, shape] of Object.entries(mock.fields ?? {})) {
    const counterpart = real.fields?.[key]
    if (counterpart) issues.push(...mockIssues(shape, counterpart, `${path}.${key}`))
    else if (real.fields) issues.push(`${path}.${key}: in the mock, not in the CMS`)
  }
  if (mock.items && real.items) issues.push(...mockIssues(mock.items, real.items, `${path}[]`))
  // A component the response does not have cannot be checked: the demo does not use every block
  for (const [name, shape] of Object.entries(mock.components ?? {})) {
    if (real.components?.[name]) issues.push(...mockIssues(shape, real.components[name], `${path}[${name}]`))
  }
  return issues
}
