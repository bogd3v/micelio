import { UnpackError } from './error'

// An SVG of a package is accepted only if a small tokenizer reads all of it and every element, attribute and value is on a list
// (ADR 0009, section 2). Anything it does not understand fails: the filter is an allowlist, not a search for known-bad text.
// Every pattern here is linear in the input: no value is matched by a regex with nested or overlapping repetition, and every lookup
// by an untrusted name goes through a Map, so a name such as `constructor` is an unknown name like any other. Spaces are the four
// XML ones (space, tab, line feed, carriage return) and nothing else: no Unicode space is ever skipped or trimmed.
// References between elements are bounded after the whole file is read (`checkReferences`).

const SVG_NS = 'http://www.w3.org/2000/svg'
/** Namespace declarations a root element may make, with the only URI each may be bound to (the key `xmlns` is the default one). */
const NAMESPACES = new Map([
  ['xmlns', SVG_NS],
  ['xmlns:xlink', 'http://www.w3.org/1999/xlink'],
  ['xmlns:svg', SVG_NS],
  ['xmlns:inkscape', 'http://www.inkscape.org/namespaces/inkscape'],
  ['xmlns:sodipodi', 'http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd'],
])
const MAX_DEPTH = 64
/** Most references (`use`, `href` and `url(#…)`) in one file. */
const MAX_REFERENCES = 1000
/** Most elements all the references of a file may point at, counting a reference to a subtree of N elements as N. */
const MAX_EXPANSION = 10_000
/** Longest chain of `href` from one gradient to another. */
const MAX_CHAIN = 8
const GRADIENTS = new Set(['linearGradient', 'radialGradient'])

/** Inert elements: shapes, containers, gradients, text. No script, style, animation, foreign content or embedded media. */
const ELEMENTS = new Set([
  'svg', 'g', 'defs', 'path', 'rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'title', 'desc', 'linearGradient',
  'radialGradient', 'stop', 'clipPath', 'mask', 'symbol', 'use', 'text', 'tspan', 'pattern',
])
/** The elements that may point to another element of the file. */
const REFERENCING = new Set(['use', 'pattern', 'linearGradient', 'radialGradient'])
/** The editor element: metadata that renders nothing, allowed wherever the element lists allow it; its children may only be `inkscape:*` elements. */
const EDITOR_ELEMENT = 'sodipodi:namedview'
const EDITOR_CHILD = 'inkscape:'

type ValueKind = 'paint' | 'reference' | 'number' | 'keyword' | 'transform' | 'path' | 'points' | 'id' | 'style' | 'fragment'
const ATTRIBUTES = new Map<string, ValueKind>(Object.entries({
  'id': 'id', 'style': 'style', 'href': 'fragment', 'xlink:href': 'fragment', 'xml:space': 'keyword',
  'width': 'number', 'height': 'number', 'viewBox': 'number', 'version': 'number', 'x': 'number', 'y': 'number', 'x1': 'number',
  'y1': 'number', 'x2': 'number', 'y2': 'number', 'cx': 'number', 'cy': 'number', 'fx': 'number', 'fy': 'number', 'r': 'number',
  'rx': 'number', 'ry': 'number', 'dx': 'number', 'dy': 'number', 'offset': 'number', 'opacity': 'number',
  'preserveAspectRatio': 'keyword', 'd': 'path', 'points': 'points', 'transform': 'transform', 'gradientTransform': 'transform',
  'patternTransform': 'transform', 'gradientUnits': 'keyword', 'patternUnits': 'keyword', 'clipPathUnits': 'keyword',
  'maskUnits': 'keyword', 'spreadMethod': 'keyword', 'text-anchor': 'keyword', 'font-size': 'number', 'font-weight': 'keyword',
  'fill': 'paint', 'stroke': 'paint', 'stop-color': 'paint', 'fill-opacity': 'number', 'stroke-opacity': 'number',
  'stop-opacity': 'number', 'stroke-width': 'number', 'stroke-miterlimit': 'number', 'stroke-dashoffset': 'number',
  'stroke-dasharray': 'number', 'stroke-linecap': 'keyword', 'stroke-linejoin': 'keyword', 'fill-rule': 'keyword',
  'clip-rule': 'keyword', 'paint-order': 'keyword', 'clip-path': 'reference', 'mask': 'reference',
} satisfies Record<string, ValueKind>))
const EDITOR_PREFIXES = new Set(['inkscape', 'sodipodi'])
/** The elements that may carry editor attributes besides the editor elements and the root: the groups and paths an editor labels. */
const EDITOR_ATTRIBUTE_ELEMENTS = new Set(['g', 'path'])
const EDITOR_NAME = /^[a-z][a-z-]*$/
/** The unprefixed attributes of the editor elements. */
const EDITOR_PLAIN = new Set(['id', 'pagecolor', 'bordercolor', 'borderopacity'])
const TRANSFORMS = new Set(['matrix', 'translate', 'scale', 'rotate', 'skewX', 'skewY'])

const PAINT = /^(?:none|currentColor|transparent|#[0-9a-fA-F]{3,8}|rgba?\([0-9.,\t\n\r %]+\)|url\(#[A-Za-z_][\w.:-]*\)|[a-z]+)$/
const REFERENCE = /^(?:none|url\(#[A-Za-z_][\w.:-]*\))$/
const NUMBER = /^(?:none|[-+0-9.eE\t\n\r ,%]+(?:px|em|pt|mm|cm|in)?)$/
const KEYWORD = /^[A-Za-z0-9\t\n\r -]+$/
const NUMBERS = /^[-+0-9.eE\t\n\r ,]*$/
const PATH = /^[MmLlHhVvCcSsQqTtAaZz0-9\t\n\r .,+eE-]+$/
const ID = /^[A-Za-z_][\w.:-]*$/
const FRAGMENT = /^#[A-Za-z_][\w.:-]*$/
const PROPERTY = /^[a-z-]+$/
/** Values of the editor attributes: text that no browser reads, kept to letters, digits and a few marks; no `:` or `/`, so no URL and no path. */
const EDITOR_VALUE = /^[A-Za-z0-9\t\n\r .,#()_-]*$/
const EDITOR_DENIED = /url\(/i
const XML_DECLARATION = /^<\?xml version="1\.[01]"(?: encoding="[Uu][Tt][Ff]-8")?(?: standalone="(?:yes|no)")?[ \t\n\r]*\?>/
const ENTITY = /&(?:amp|lt|gt|quot|apos);/g
const SPACES = new Set([' ', '\t', '\n', '\r'])
const NAME = /^[A-Za-z][A-Za-z0-9-]*(?::[A-Za-z][A-Za-z0-9-]*)?$/

/** Trims the four XML spaces only; `String.prototype.trim` would also strip U+00A0, U+2028 and the other Unicode spaces. */
function trimXml(value: string): string {
  let start = 0
  let end = value.length
  while (start < end && SPACES.has(value[start] ?? '')) start += 1
  while (end > start && SPACES.has(value[end - 1] ?? '')) end -= 1
  return value.slice(start, end)
}

function fail(path: string, detail: string): never {
  throw new UnpackError('svg', detail, path)
}

/** A `transform` list: only the six SVG functions, each with numbers; read by scanning, not by one pattern over the whole value. */
function isTransform(value: string): boolean {
  let at = 0
  for (;;) {
    while (at < value.length && (SPACES.has(value[at] ?? '') || value[at] === ',')) at += 1
    if (at >= value.length) return value !== ''
    const open = value.indexOf('(', at)
    if (open < 0 || !TRANSFORMS.has(trimXml(value.slice(at, open)))) return false
    const close = value.indexOf(')', open)
    if (close < 0 || !NUMBERS.test(value.slice(open + 1, close))) return false
    at = close + 1
  }
}

function valid(kind: ValueKind, value: string): boolean {
  switch (kind) {
    case 'paint': return PAINT.test(value)
    case 'reference': return REFERENCE.test(value)
    case 'number': return NUMBER.test(value)
    case 'keyword': return KEYWORD.test(value)
    case 'transform': return isTransform(value)
    case 'path': return PATH.test(value)
    case 'points': return NUMBERS.test(value)
    case 'id': return ID.test(value)
    case 'fragment': return FRAGMENT.test(value)
    default: return false
  }
}

/** The declarations of a `style` attribute: each property on the attribute list (not `style`, `id` or a reference) and its value of that kind. */
function checkStyle(value: string, path: string): void {
  for (const declaration of value.split(';')) {
    if (trimXml(declaration) === '') continue
    const colon = declaration.indexOf(':')
    const name = colon < 0 ? '' : trimXml(declaration.slice(0, colon))
    const text = colon < 0 ? '' : trimXml(declaration.slice(colon + 1))
    const kind = PROPERTY.test(name) ? ATTRIBUTES.get(name) : undefined
    if (text === '' || !kind || kind === 'style' || kind === 'id' || kind === 'fragment' || !valid(kind, text)) {
      fail(path, 'has a style declaration that is not on the list of inert properties and values')
    }
  }
}

function isEditorElement(element: string): boolean {
  return element === EDITOR_ELEMENT || element.startsWith(EDITOR_CHILD)
}

function checkValue(element: string, name: string, value: string, root: boolean, path: string): void {
  if (/[&<\\]/.test(value) || [...value].some(char => char.charCodeAt(0) < 0x20 && char !== '\t' && char !== '\n' && char !== '\r')) {
    fail(path, `has the attribute ${name} with a character that is not accepted in a value`)
  }
  const prefix = name.split(':')[0] ?? ''
  if ((name.includes(':') && EDITOR_PREFIXES.has(prefix)) || (isEditorElement(element) && EDITOR_PLAIN.has(name))) {
    const local = name.slice(name.indexOf(':') + 1)
    const where = root || isEditorElement(element) || EDITOR_ATTRIBUTE_ELEMENTS.has(element)
    if (!where || (name.includes(':') && (!EDITOR_NAME.test(local) || local.startsWith('on')))) fail(path, `has the editor attribute ${name} where it is not accepted`)
    if (!EDITOR_VALUE.test(value) || EDITOR_DENIED.test(value)) fail(path, `has the attribute ${name} with a value that is not accepted`)
    return
  }
  const kind = ATTRIBUTES.get(name)
  if (!kind) fail(path, `has the attribute ${name}, which is not on the list`)
  if (kind === 'style') checkStyle(value, path)
  else if (!valid(kind, value)) fail(path, `has the attribute ${name} with a value that is not accepted (only local fragments, colors and plain numbers)`)
}

/** Reads `name="value"` pairs up to the end of a tag; returns them and the index after `>`. */
function readAttributes(source: string, start: number, path: string): { attributes: Map<string, string>, end: number, selfClosing: boolean } {
  const attributes = new Map<string, string>()
  const pattern = /[ \t\n\r]+([^ \t\n\r=/>]+)[ \t\n\r]*=[ \t\n\r]*(?:"([^"]*)"|'([^']*)')|[ \t\n\r]*(\/?)>/y
  let at = start
  for (;;) {
    pattern.lastIndex = at
    const match = pattern.exec(source)
    if (!match) fail(path, 'has a tag the reader cannot follow')
    at = pattern.lastIndex
    if (match[1] === undefined) return { attributes, end: at, selfClosing: match[4] === '/' }
    if (!NAME.test(match[1])) fail(path, 'has an attribute name that is not a plain name')
    if (attributes.has(match[1])) fail(path, `repeats the attribute ${match[1]}`)
    attributes.set(match[1], match[2] ?? match[3] ?? '')
  }
}

interface Reference {
  /** The `id` it points at. */
  id: string
  /** An `href` from one gradient to another: bounded as a chain, not as a reference to a subtree. */
  chain: boolean
  /** The other references that apply to the element it is written on: its own, besides this one, and those of its ancestors. */
  others: number
  /** The element it is written on; its `size` is the number of elements in that element's subtree, known once it is closed. */
  host?: { size: number }
}

/** What a subtree holds, kept for every element that has an `id`. */
interface Target {
  name: string
  /** Elements in the subtree, itself included. */
  size: number
  /** References inside it, chains excluded. */
  references: number
  /** References written on its ancestors, which it inherits. */
  inherited: number
}

interface Frame {
  /** Shared with the references written on this element; `size` is set when the element closes. */
  box: { size: number }
  name: string
  id?: string
  size: number
  /** References in the subtree, itself included, chains excluded. */
  references: number
  /** References written on the element itself, chains excluded. */
  own: number
  /** References written on its ancestors. */
  inherited: number
}

/** The ids that `url(#…)` points at in a value that already passed its checks. */
function urlTargets(value: string, path: string): string[] {
  const found: string[] = []
  for (let at = value.indexOf('url(#'); at >= 0; at = value.indexOf('url(#', at + 5)) {
    const end = value.indexOf(')', at)
    if (end < 0) fail(path, 'has a reference that is not closed')
    found.push(value.slice(at + 5, end))
  }
  return found
}

function checkAttributes(element: string, attributes: Map<string, string>, root: boolean, declared: Set<string>, path: string): Reference[] {
  const references: Reference[] = []
  for (const [name, value] of attributes) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) {
      if (!root || NAMESPACES.get(name) !== value) fail(path, `has ${name} with a namespace that is not accepted`)
      declared.add(name)
    }
  }
  for (const [name, value] of attributes) {
    if (name === 'xmlns' || name.startsWith('xmlns:')) continue
    const prefix = name.includes(':') ? name.split(':')[0] : undefined
    if (prefix && prefix !== 'xml' && !declared.has(`xmlns:${prefix}`)) fail(path, `uses the prefix ${prefix} without declaring it on the root`)
    if (prefix && prefix !== 'xml' && prefix !== 'xlink' && !EDITOR_PREFIXES.has(prefix)) fail(path, `has the attribute ${name}, whose prefix is not accepted`)
    if ((name === 'href' || name === 'xlink:href') && !REFERENCING.has(element)) fail(path, `has a reference on <${element}>, which may not have one`)
    checkValue(element, name, value, root, path)
    if (name === 'href' || name === 'xlink:href') references.push({ id: value.slice(1), chain: GRADIENTS.has(element), others: 0 })
    else if (value.includes('url(')) references.push(...urlTargets(value, path).map(id => ({ id, chain: false, others: 0 })))
  }
  if (element === 'use' && !attributes.has('href') && !attributes.has('xlink:href')) fail(path, 'has a <use> without a local reference')
  return references
}

function checkText(text: string, path: string): void {
  if (text.replace(ENTITY, '').includes('&')) fail(path, 'has a character reference other than &amp; &lt; &gt; &quot; &apos;')
}

/**
 * An XML comment that no HTML parser reads differently: it does not start with `>` or `->`, end with `-`, or hold `--`, `<` or `>`.
 *
 * @param body - The text between `<!--` and the first `-->`.
 */
function checkComment(body: string, path: string): void {
  if (body.startsWith('>') || body.startsWith('->') || body.endsWith('-') || body.includes('--') || body.includes('<') || body.includes('>')) {
    fail(path, 'has a comment that an HTML parser would read differently')
  }
}

/** Rejects control characters, DEL and the C1 range, which also stops other encodings (ESC, UTF-16 without a BOM) and a BOM. */
function checkCharacters(source: string, path: string): void {
  for (const char of source) {
    const code = char.codePointAt(0) ?? 0
    const control = code < 0x20 ? code !== 9 && code !== 10 && code !== 13 : code >= 0x7F && code <= 0x9F
    if (control || code === 0xFEFF || code === 0xFFFE || code === 0xFFFF) fail(path, 'has a control or byte-order character')
  }
}

/**
 * Bounds how references between elements add up, once the whole file is read (a target may come after the reference).
 *
 * @remarks
 * The invariant: the work a reference causes is bounded by the size of its target's subtree, plus all the references that apply to
 * that subtree, multiplied by the number of elements that apply the reference. A reference written on a container applies to
 * every element of its subtree, so it is charged for all of them (a mask or a clip path is applied once to its host, which makes
 * charging it per element stricter than needed; that is deliberate). The charge of a reference is the sum of the sizes of its
 * target and, for a gradient, of the gradients its `href` chain leads to (at most 9), times the size of the host's subtree. The
 * charges of all the references of a file add up to at most 10,000.
 *
 * @remarks
 * Instead of modelling what is inherited, the rule refuses on any doubt: a target may not hold a reference, nor sit under an
 * element that carries one (gradients chain by `href` for at most 8 hops and never in a cycle); an element that carries other
 * references, or sits under one that does, may not point at a container; and a file has at most 1,000 references. A file that fails
 * can be flattened (paint the shapes directly instead of their container). The counts are carried down the tree while it is read
 * and each host's size is known when it closes, so this is one pass over the references, each followed at most 9 hops: linear.
 */
function checkReferences(references: Reference[], targets: Map<string, Target>, chains: Map<string, string>, path: string): void {
  if (references.length > MAX_REFERENCES) fail(path, `has more than ${MAX_REFERENCES} references`)
  let expansion = 0
  for (const { id, chain, others, host } of references) {
    const target = targets.get(id)
    if (!target) fail(path, `has a reference to #${id}, which is not an element of the file`)
    let weight = target.size
    if (!chain && GRADIENTS.has(target.name)) {
      for (let next = chains.get(id), hops = 0; next !== undefined && hops < MAX_CHAIN; next = chains.get(next), hops += 1) weight += targets.get(next)?.size ?? 0
    }
    expansion += weight * (chain ? 1 : (host?.size ?? 1))
    if (target.references > 0 || target.inherited > 0) fail(path, 'has a reference to an element that holds references, or that sits under an element that carries one')
    if (chain) {
      if (!GRADIENTS.has(target.name)) fail(path, 'has a gradient whose href is not a gradient')
      let hops = 1
      for (let next = chains.get(id); next !== undefined; next = chains.get(next)) {
        hops += 1
        if (hops > MAX_CHAIN) fail(path, `has a chain of gradients longer than ${MAX_CHAIN}, or a cycle`)
      }
    } else if (!GRADIENTS.has(target.name) && target.size > 1 && others > 0) {
      fail(path, 'has an element that carries other references and points at a container')
    }
  }
  if (expansion > MAX_EXPANSION) fail(path, `has references that add up to more than ${MAX_EXPANSION} elements`)
}

/** Whether an element may appear under its parent (the top of the stack, or none at the root). */
function placed(name: string, parent: string | undefined): boolean {
  if (parent !== undefined && isEditorElement(parent)) return name.startsWith(EDITOR_CHILD)
  if (name.startsWith(EDITOR_CHILD)) return false
  return ELEMENTS.has(name) || name === EDITOR_ELEMENT
}

/**
 * Checks that SVG text is inert: well-formed enough to read, only listed elements and attributes, only local references.
 *
 * @remarks
 * Fails on anything it does not recognise (DOCTYPE, entities, CDATA, processing instructions, scripts, styles, animation, foreign
 * content, prefixes other than the editor's and `xlink`, character references, remote or encoded URLs, comments an HTML parser would
 * read differently). The accepted lists are the minimum that the shipped themes need. It reads the input in linear time.
 *
 * @param source - The file decoded as strict UTF-8.
 * @throws `UnpackError` with the rule `svg`.
 */
export function checkSvg(source: string, path: string): void {
  checkCharacters(source, path)
  let at = XML_DECLARATION.exec(source)?.[0].length ?? 0
  const stack: Frame[] = []
  const declared = new Set<string>()
  const references: Reference[] = []
  const targets = new Map<string, Target>()
  const chains = new Map<string, string>()
  let roots = 0

  function close(): Frame | undefined {
    const frame = stack.pop()
    const parent = stack.at(-1)
    if (frame) frame.box.size = frame.size
    if (frame && parent) {
      parent.size += frame.size
      parent.references += frame.references
    }
    if (frame?.id !== undefined) targets.set(frame.id, { name: frame.name, size: frame.size, references: frame.references, inherited: frame.inherited })
    return frame
  }

  while (at < source.length) {
    const open = source.indexOf('<', at)
    const text = source.slice(at, open < 0 ? source.length : open)
    checkText(text, path)
    if (trimXml(text) !== '' && stack.length === 0) fail(path, 'has text outside the root element')
    if (open < 0) break
    if (source.startsWith('<!--', open)) {
      const end = source.indexOf('-->', open + 4)
      if (end < 0) fail(path, 'has a comment that is not closed')
      checkComment(source.slice(open + 4, end), path)
      at = end + 3
    } else if (source[open + 1] === '!' || source[open + 1] === '?') {
      fail(path, 'has a declaration, CDATA section or processing instruction')
    } else if (source[open + 1] === '/') {
      const end = source.indexOf('>', open)
      if (end < 0 || source.slice(open + 2, end) !== stack.at(-1)?.name) fail(path, 'has a closing tag that does not match')
      close()
      at = end + 1
    } else {
      const name = /^[^ \t\n\r/>]*/.exec(source.slice(open + 1, open + 80))?.[0] ?? ''
      if (!NAME.test(name) || !placed(name, stack.at(-1)?.name)) fail(path, `has the element <${name}>, which is not on the list or not allowed here`)
      if (name === 'svg') roots += 1
      if ((name === 'svg') !== (stack.length === 0) || roots > 1) fail(path, 'must have exactly one <svg> root, with nothing else at the top')
      if (isEditorElement(name) && !declared.has(name === EDITOR_ELEMENT ? 'xmlns:sodipodi' : 'xmlns:inkscape')) fail(path, 'uses an editor namespace without declaring it on the root')
      const { attributes, end, selfClosing } = readAttributes(source, open + 1 + name.length, path)
      const found = checkAttributes(name, attributes, stack.length === 0, declared, path)
      const id = attributes.get('id')
      if (id !== undefined && (targets.has(id) || stack.some(frame => frame.id === id))) fail(path, `repeats the id ${id}`)
      const box = { size: 1 }
      const parent = stack.at(-1)
      const own = found.filter(reference => !reference.chain).length
      const inherited = parent ? parent.inherited + parent.own : 0
      references.push(...found.map(reference => (reference.chain ? reference : { ...reference, others: own - 1 + inherited, host: box })))
      if (id !== undefined && GRADIENTS.has(name)) {
        const chain = found.find(reference => reference.chain)
        if (chain) chains.set(id, chain.id)
      }
      stack.push({ box, name, id, size: 1, references: own, own, inherited })
      if (selfClosing) close()
      if (stack.length > MAX_DEPTH) fail(path, `is nested deeper than ${MAX_DEPTH} elements`)
      at = end
    }
  }
  if (stack.length > 0 || roots !== 1) fail(path, 'has an element that is not closed, or no <svg> root')
  checkReferences(references, targets, chains, path)
}
