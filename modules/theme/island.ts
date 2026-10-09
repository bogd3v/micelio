import { babelParse, parse } from '@vue/compiler-sfc'

// ADR 0005, section 12: a slot that is not declared an island ships no interactivity, and no slot ships <style>.
// A contract lint over the slot's own file (slots are operator-trusted code; the CSP is the boundary).
// The slot still hydrates like any component: lazy hydration is a later step.

/** Calls that make a component interactive or schedule work on the client. */
const CALLS = new Set([
  'onMounted', 'onBeforeMount', 'onUpdated', 'onBeforeUpdate', 'onUnmounted', 'onBeforeUnmount', 'onActivated', 'onDeactivated', 'onErrorCaptured',
  'useState', 'watch', 'watchEffect', 'watchPostEffect', 'watchSyncEffect',
  'setInterval', 'setTimeout', 'requestAnimationFrame', 'addEventListener',
])

/** Options API hooks, as keys of the component object. */
const OPTION_HOOKS = new Set(['mounted', 'beforeMount', 'updated', 'beforeUpdate', 'unmounted', 'beforeUnmount', 'activated', 'deactivated', 'errorCaptured'])

const ELEMENT_ATTRIBUTE = 6
const DIRECTIVE = 7
const EVENT_PROP = /^on[A-Z]/
const INLINE_HANDLER = /^on[a-z]+$/i

interface TemplateNode {
  type: number
  name?: string
  props?: TemplateNode[]
  children?: TemplateNode[]
  arg?: { content?: string, isStatic?: boolean }
}

function directives(node: TemplateNode, found: Set<string>): void {
  for (const prop of node.props ?? []) {
    if (prop.type === ELEMENT_ATTRIBUTE && prop.name && INLINE_HANDLER.test(prop.name)) found.add(prop.name)
    if (prop.type !== DIRECTIVE) continue
    if (prop.name === 'on') found.add(prop.arg?.content ? `@${prop.arg.content}` : 'v-on')
    else if (prop.name === 'model') found.add('v-model')
    else if (prop.name === 'bind') {
      if (!prop.arg) found.add('v-bind with an object')
      else if (!prop.arg.isStatic) found.add('v-bind with a dynamic argument')
      else if (prop.arg.content && EVENT_PROP.test(prop.arg.content)) found.add(`:${prop.arg.content}`)
    }
  }
  for (const child of node.children ?? []) directives(child, found)
}

function keyName(key: unknown): string | undefined {
  const node = key as { type?: string, name?: string, value?: unknown } | undefined
  if (node?.type === 'Identifier') return node.name
  if (node?.type === 'StringLiteral' && typeof node.value === 'string') return node.value
  return undefined
}

function calleeName(callee: unknown): string | undefined {
  const node = callee as { type?: string, name?: string, property?: unknown, computed?: boolean } | undefined
  if (node?.type === 'Identifier') return node.name
  if ((node?.type === 'MemberExpression' || node?.type === 'OptionalMemberExpression') && !node.computed) return keyName(node.property)
  return undefined
}

function walk(node: unknown, found: Set<string>): void {
  if (Array.isArray(node)) {
    for (const item of node) walk(item, found)
    return
  }
  if (!node || typeof node !== 'object') return
  const ast = node as { type?: string, callee?: unknown, key?: unknown, value?: unknown, computed?: boolean }
  if (ast.type === 'CallExpression' || ast.type === 'OptionalCallExpression') {
    const name = calleeName(ast.callee)
    if (name && CALLS.has(name)) found.add(name)
  } else if ((ast.type === 'ObjectMethod' || ast.type === 'ObjectProperty') && !ast.computed) {
    const name = keyName(ast.key)
    const isFunction = ast.type === 'ObjectMethod' || ['FunctionExpression', 'ArrowFunctionExpression'].includes((ast.value as { type?: string } | undefined)?.type ?? '')
    if (name && OPTION_HOOKS.has(name) && isFunction) found.add(`${name}()`)
  }
  for (const [key, value] of Object.entries(node)) {
    if (key !== 'loc' && key !== 'extra' && value && typeof value === 'object') walk(value, found)
  }
}

/** Problems of a slot component; `file` is its name in messages (e.g. slots/ThemeMark.vue). A declared island may be interactive, but no slot ships <style>. */
export function slotProblems(source: string, file: string, island: boolean): string[] {
  const { descriptor, errors } = parse(source, { filename: file })
  if (errors.length) return [`${file}: cannot parse the component: ${errors[0]!.message}`]
  const problems: string[] = []
  if (descriptor.styles.length) problems.push(`${file}: has a <style> block; a slot's CSS goes in slots/*.css, which is imported into the myc.theme layer and checked against the hooks (a <style> block is bundled outside the layer)`)
  if (island) return problems
  const found = new Set<string>()
  if (descriptor.template?.ast) directives(descriptor.template.ast as unknown as TemplateNode, found)
  for (const block of [descriptor.script, descriptor.scriptSetup]) {
    if (!block) continue
    try {
      walk(babelParse(block.content, { sourceType: 'module', plugins: ['typescript'], allowAwaitOutsideFunction: true }).program, found)
    } catch (error) {
      return [...problems, `${file}: cannot parse the script: ${(error as Error).message}`]
    }
  }
  const hint = 'a slot that needs JavaScript declares "island": true in theme.json (ADR 0005, section 12)'
  return [...problems, ...[...found].sort().map(what => `${file}: uses ${what}, which is interactive; ${hint}`)]
}
