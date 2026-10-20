import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { checkContent } from '../modules/theme/registry/content'
import { UnpackError } from '../modules/theme/registry/error'

// The SVG filter is an allowlist (ADR 0009, section 2): each class of input below must fail, and the shipped files must pass

const MIB = 1024 * 1024
const SVG = 'xmlns="http://www.w3.org/2000/svg"'
const XLINK = 'xmlns:xlink="http://www.w3.org/1999/xlink"'

function check(svg: string | Buffer): void {
  checkContent('images/a.svg', typeof svg === 'string' ? Buffer.from(svg) : svg)
}

function rejected(svg: string | Buffer): string {
  try {
    check(svg)
  } catch (error) {
    expect(error).toBeInstanceOf(UnpackError)
    expect((error as UnpackError).rule).toBe('svg')
    expect((error as UnpackError).path).toBe('images/a.svg')
    return (error as UnpackError).message
  }
  throw new Error('the svg was accepted')
}

describe('svg that passes', () => {
  it.each(['themes/bogota/images/bogdev.svg', 'themes/bogota/images/bogdev-black.svg', 'themes/bogota/images/bogdev-white.svg', 'themes/starter/images/favicon.svg'])('accepts the shipped %s', (file) => {
    expect(() => checkContent(file, readFileSync(join(process.cwd(), file)))).not.toThrow()
  })

  it('accepts shapes, gradients, local references and entities', () => {
    check(`<?xml version="1.0" encoding="UTF-8"?><svg ${SVG} ${XLINK} viewBox="0 0 10 10"><title>A &amp; B</title><defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/></linearGradient></defs><rect fill="url(#g)" width="10" height="10"/><use xlink:href="#g"/><g clip-path="url(#g)" style="fill:none;stroke:#000;stroke-width:2"><path d="M0 0L5 5"/></g></svg>`)
  })

  it('accepts transforms, path data, points and references on the elements that may have them', () => {
    check(`<svg ${SVG} ${XLINK}><defs><linearGradient id="a" xlink:href="#b"/><radialGradient id="b"/><pattern id="p" href="#a" patternTransform="rotate(45)"/></defs><path d="M1,2 L3.5e-1 -4 z" transform="translate(1,2) rotate(45 1 2) scale(2) skewX(3) skewY(4) matrix(1 0 0 1 0 0)" style="transform:scale(2)"/><polygon points="0,0 1,1 2,0"/></svg>`)
  })

  it('accepts editor metadata with an editor child and plain file names', () => {
    check(`<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" inkscape:export-filename="logo.png"><sodipodi:namedview id="n" pagecolor="#fff" inkscape:zoom="0.5"><inkscape:page id="p"/></sodipodi:namedview></svg>`)
  })

  it('accepts a plain comment and whitespace around the root', () => {
    check(`\n<!-- made by hand -->\n<svg ${SVG}/>\n`)
  })
})

describe('svg that fails', () => {
  const bound = (extra: string): string => `<svg ${SVG} ${extra}`
  const cases: Array<[string, string | Buffer]> = [
    ['a script', `<svg ${SVG}><script>alert(1)</script></svg>`],
    ['a script in another case', `<svg ${SVG}><SCRIPT>x</SCRIPT></svg>`],
    ['a script under a namespace prefix', `${bound('xmlns:s="http://www.w3.org/2000/svg">')}<s:script>alert(1)</s:script></svg>`],
    ['an undeclared prefix', `<svg ${SVG}><s:script>alert(1)</s:script></svg>`],
    ['a script from the XHTML namespace', `<svg ${SVG}><html:script xmlns:html="http://www.w3.org/1999/xhtml">alert(1)</html:script></svg>`],
    ['a prefixed foreignObject with an iframe', `${bound('xmlns:svg="http://www.w3.org/2000/svg">')}<svg:foreignObject><iframe xmlns="http://www.w3.org/1999/xhtml" src="javascript:alert(1)"/></svg:foreignObject></svg>`],
    ['a foreignObject', `<svg ${SVG}><foreignObject><div/></foreignObject></svg>`],
    ['a remote src on a prefixed XHTML img', `${bound('xmlns:h="http://www.w3.org/1999/xhtml">')}<h:img src="https://example.com/a.png"/></svg>`],
    ['an onload attribute', `<svg ${SVG} onload="x()"/>`],
    ['an event attribute in single quotes after a space', `<svg ${SVG}><rect onclick = 'x()'/></svg>`],
    ['an external href', `<svg ${SVG}><image href="https://example.com/a.png"/></svg>`],
    ['a protocol-relative href', `<svg ${SVG}><use href="//example.com/a.svg#b"/></svg>`],
    ['an xlink:href to another file', `<svg ${SVG} ${XLINK}><use xlink:href="other.svg#a"/></svg>`],
    ['a javascript: href', `<svg ${SVG}><a href="javascript:x()"><rect/></a></svg>`],
    ['a data: href', `<svg ${SVG}><image href="data:image/svg+xml;base64,PHN2Zy8+"/></svg>`],
    ['an unquoted attribute', `<svg ${SVG}><use href=#a /></svg>`],
    ['another prefix bound to the xlink namespace with a remote href', `${bound('xmlns:x="http://www.w3.org/1999/xlink">')}<use x:href="https://example.com/a.svg#b"/></svg>`],
    ['another prefix bound to the xlink namespace with a javascript: href', `${bound('xmlns:x="http://www.w3.org/1999/xlink">')}<a x:href="javascript:alert(1)"/></svg>`],
    ['xlink bound to another namespace', `<svg ${SVG} xmlns:xlink="http://example.com/ns"><use xlink:href="#a"/></svg>`],
    ['a namespace declared below the root', `<svg ${SVG}><g xmlns:xlink="http://www.w3.org/1999/xlink"/></svg>`],
    ['a default namespace that is not SVG', '<svg xmlns="http://www.w3.org/1999/xhtml"/>'],
    ['a set that animates href', `<svg ${SVG}><a><set attributeName="href" to="javascript:x()"/></a></svg>`],
    ['an animate that animates href', `<svg ${SVG}><a><animate attributeName="href" values="javascript:x()"/></a></svg>`],
    ['a set with a space before the attribute name value', `<svg ${SVG}><a><set attributeName=" href" to="javascript:x()"/></a></svg>`],
    ['a prefixed set', `${bound('xmlns:svg="http://www.w3.org/2000/svg">')}<a><svg:set attributeName="href" to="x"/></a></svg>`],
    ['an attribute name as a numeric character reference', `<svg ${SVG}><a><set attributeName="&#104;ref" to="x"/></a></svg>`],
    ['an animateTransform', `<svg ${SVG}><rect><animateTransform attributeName="transform" type="rotate"/></rect></svg>`],
    ['a reference on a rect', `<svg ${SVG}><rect href="#a"/></svg>`],
    ['a reference on a group', `<svg ${SVG} ${XLINK}><g xlink:href="#a"/></svg>`],
    ['an image element', `<svg ${SVG}><image href="#a"/></svg>`],
    ['a transform that is not a list of transform functions', `<svg ${SVG}><g transform="expression(alert(1))"/></svg>`],
    ['a transform with var()', `<svg ${SVG}><g transform="translate(var(--x))"/></svg>`],
    ['a transform with url()', `<svg ${SVG}><g transform="url(x)"/></svg>`],
    ['an unknown transform function', `<svg ${SVG}><g transform="foo(1)"/></svg>`],
    ['a transform argument that is not a number', `<svg ${SVG}><g transform="scale(a)"/></svg>`],
    ['a transform in style with url()', `<svg ${SVG}><g style="transform:url(x)"/></svg>`],
    ['path data with a function', `<svg ${SVG}><path d="url(x)"/></svg>`],
    ['path data in style with a function', `<svg ${SVG}><path style="d:expression(x)"/></svg>`],
    ['points with a function', `<svg ${SVG}><polygon points="var(--x)"/></svg>`],
    ['an attribute named like an object member', `<svg ${SVG} __proto__="x"/>`],
    ['an attribute named constructor', `<svg ${SVG} constructor="x"/>`],
    ['an attribute named toString', `<svg ${SVG}><g toString="x"/></svg>`],
    ['a style property named constructor', `<svg ${SVG}><g style="constructor:1"/></svg>`],
    ['a style property named __proto__', `<svg ${SVG}><g style="__proto__:none"/></svg>`],
    ['a style declaration without a colon', `<svg ${SVG}><g style="fill"/></svg>`],
    ['a style declaration without a value', `<svg ${SVG}><g style="fill: ;"/></svg>`],
    ['an attribute name with a quote', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:a"x="1"/>`],
    ['an attribute name with a less-than sign', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:a<b="1"/>`],
    ['an attribute name with two colons', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:a:b="1"/>`],
    ['an attribute name that is only a prefix', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:="1"/>`],
    ['whitespace after the slash of a closing tag', `<svg ${SVG}><g></ g></svg>`],
    ['a line break before the end of a closing tag', `<svg ${SVG}><g></g\n></svg>`],
    ['a comment that starts with a greater-than sign', `<svg ${SVG}/><!--> x -->`],
    ['a comment that starts with a dash and a greater-than sign', `<svg ${SVG}/><!---> x -->`],
    ['a comment that ends with a dash', `<svg ${SVG}/><!-- x --->`],
    ['a comment with a double dash', `<svg ${SVG}/><!-- x -- y -->`],
    ['a comment with a less-than sign', `<svg ${SVG}/><!-- <g> -->`],
    ['a comment with a greater-than sign', `<svg ${SVG}/><!-- a > b -->`],
    ['an element other than an editor one inside the editor metadata', `<svg ${SVG} xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"><sodipodi:namedview><use href="#a"/></sodipodi:namedview></svg>`],
    ['an editor child outside the editor metadata', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape"><inkscape:page/></svg>`],
    ['an editor attribute that is a URL', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:export-filename="https://example.com/a.png"/>`],
    ['an editor attribute that is an absolute path', `<svg ${SVG} xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" sodipodi:absref="/etc/passwd"/>`],
    ['an editor attribute that leaves the folder', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:export-filename="../a.png"/>`],
    ['a style element with an import', `<svg ${SVG}><style>@import "https://example.com/a.css";</style></svg>`],
    ['an import written with an entity', `<svg ${SVG}><style>@&#105;mport "https://example.com/a.css";</style></svg>`],
    ['an import split across CDATA sections', `<svg ${SVG}><style>@im<![CDATA[port]]> url(https://example.com/a.css);</style></svg>`],
    ['a CDATA section', `<svg ${SVG}><desc><![CDATA[x]]></desc></svg>`],
    ['a url() to a remote file in style', `<svg ${SVG}><rect style="fill:url(https://example.com/a)"/></svg>`],
    ['a url() with CSS escapes in style', `<svg ${SVG}><rect style="fill:url(\\68ttps://example.com/a)"/></svg>`],
    ['a url() with CSS escapes in a presentation attribute', `<svg ${SVG}><rect fill="url(\\68ttp://example.com/a)"/></svg>`],
    ['a quoted url() in style', `<svg ${SVG}><rect style="fill:url( 'x.png' )"/></svg>`],
    ['an image-set() in style', `<svg ${SVG}><rect style="background:image-set(url(a.png) 1x)"/></svg>`],
    ['a style property that is not listed', `<svg ${SVG}><rect style="behavior:url(#a)"/></svg>`],
    ['a url() in an attribute that takes numbers', `<svg ${SVG}><rect width="url(#a)"/></svg>`],
    ['a mask with a remote reference', `<svg ${SVG}><rect mask="url(https://example.com/m.svg#m)"/></svg>`],
    ['a doctype', '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "http://www.w3.org/Graphics/SVG/1.1/DTD/svg11.dtd"><svg xmlns="http://www.w3.org/2000/svg"/>'],
    ['an entity declaration', `<!DOCTYPE svg [<!ENTITY x SYSTEM "file:///etc/passwd">]><svg ${SVG}>&x;</svg>`],
    ['a character reference', `<svg ${SVG}><text>&#60;script&#62;</text></svg>`],
    ['an unknown named entity', `<svg ${SVG}><text>&nbsp;</text></svg>`],
    ['a processing instruction', `<?xml-stylesheet href="a.css"?><svg ${SVG}/>`],
    ['an XML declaration in another encoding', `<?xml version="1.0" encoding="ISO-2022-JP"?><svg ${SVG}/>`],
    ['ISO-2022-JP escape bytes', Buffer.concat([Buffer.from(`<svg ${SVG}><title>`), Buffer.from([0x1B, 0x28, 0x42]), Buffer.from('</title></svg>')])],
    ['UTF-16LE without a byte-order mark', Buffer.from(`<svg ${SVG}/>`, 'utf16le')],
    ['a byte-order mark', Buffer.concat([Buffer.from([0xEF, 0xBB, 0xBF]), Buffer.from(`<svg ${SVG}/>`)])],
    ['a NUL byte', Buffer.from(`<svg ${SVG}><title>a\0b</title></svg>`)],
    ['bytes that are not UTF-8', Buffer.from([0x3C, 0xFF, 0xFE, 0x3E])],
    ['text outside the root', `<svg ${SVG}/>junk`],
    ['two roots', `<svg ${SVG}/><svg ${SVG}/>`],
    ['an svg inside the root', `<svg ${SVG}><svg/></svg>`],
    ['a root that is not svg', '<g xmlns="http://www.w3.org/2000/svg"/>'],
    ['a tag that is not closed', `<svg ${SVG}><g></svg>`],
    ['a closing tag that does not match', `<svg ${SVG}><g></rect></svg>`],
    ['a repeated attribute', `<svg ${SVG} width="1" width="2"/>`],
    ['a use without a reference', `<svg ${SVG}><use/></svg>`],
    ['an attribute that is not listed', `<svg ${SVG} data-x="1"/>`],
    ['a class attribute', `<svg ${SVG} class="a"/>`],
    ['a prefix on an attribute that is not declared', `<svg ${SVG} inkscape:version="1"/>`],
    ['an editor attribute that tries a script URL', `<svg ${SVG} xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" inkscape:x="javascript:alert(1)"/>`],
    ['a less-than sign in a value', `<svg ${SVG} id="a<b"/>`],
    ['a comment that is not closed', `<svg ${SVG}/><!-- x`],
    ['nothing', ''],
  ]
  it.each(cases)('rejects %s', (_, svg) => {
    rejected(svg)
  })

  it('says why in the message', () => {
    expect(rejected(`<svg ${SVG}><script>x</script></svg>`)).toMatch(/not on the list/)
  })
})

describe('references between elements', () => {
  const wrap = (inner: string): string => `<svg ${SVG}>${inner}</svg>`
  const shape = '<rect id="s0" width="1" height="1"/>'
  const previous = (i: number, prefix: string): string => `${prefix}${i === 0 ? '0' : i}`
  /** Groups g1..gN where each holds `fan` uses of the previous one. */
  const chain = (depth: number, fan: number): string => shape + Array.from({ length: depth }, (_, i) => `<g id="g${i + 1}">${`<use href="#${i === 0 ? 's0' : `g${i}`}"/>`.repeat(fan)}</g>`).join('')

  it('accepts a few references to plain shapes, forward ones too', () => {
    check(wrap(`<use href="#late"/><use href="#late"/><g fill="url(#grad)"/><linearGradient id="grad"><stop offset="0" stop-color="#fff"/></linearGradient><rect id="late" width="1" height="1"/>`))
  })

  it('rejects a chain of groups that each hold several references to the previous one', () => {
    expect(rejected(wrap(chain(6, 3)))).toMatch(/holds references/)
  })

  it('rejects a chain of patterns whose children are filled with the previous one', () => {
    const patterns = Array.from({ length: 5 }, (_, i) => `<pattern id="p${i + 1}"><rect fill="url(#${previous(i, 'p')})"/><rect fill="url(#${previous(i, 'p')})"/></pattern>`).join('')
    expect(rejected(wrap(`<pattern id="p0"><rect width="1" height="1"/></pattern>${patterns}<rect fill="url(#p5)"/>`))).toMatch(/holds references/)
  })

  it('rejects a chain of masks that each use the previous one', () => {
    const masks = Array.from({ length: 5 }, (_, i) => `<mask id="m${i + 1}"><rect mask="url(#${previous(i, 'm')})"/><rect mask="url(#${previous(i, 'm')})"/></mask>`).join('')
    expect(rejected(wrap(`<mask id="m0"><rect/></mask>${masks}<rect mask="url(#m5)"/>`))).toMatch(/holds references/)
  })

  it('rejects clip paths that reference each other', () => {
    expect(rejected(wrap('<clipPath id="a"><rect clip-path="url(#b)"/></clipPath><clipPath id="b"><rect/></clipPath><rect clip-path="url(#a)"/>'))).toMatch(/holds references/)
  })

  it('rejects a reference cycle and an element that references itself', () => {
    rejected(wrap('<g id="a"><use href="#b"/></g><g id="b"><use href="#a"/></g>'))
    rejected(wrap('<g id="a"><use href="#a"/></g>'))
  })

  it('rejects a reference to an id that is not in the file', () => {
    expect(rejected(wrap('<use href="#nowhere"/>'))).toMatch(/not an element of the file/)
    rejected(wrap('<rect fill="url(#nowhere)"/>'))
  })

  it('rejects an id that is used twice', () => {
    expect(rejected(wrap('<rect id="a"/><rect id="a"/>'))).toMatch(/repeats the id/)
    rejected(wrap('<g id="a"><rect id="a"/></g>'))
  })

  const gradients = (count: number, cyclic = false): string => Array.from({ length: count }, (_, i) => `<linearGradient id="g${i}"${i + 1 < count ? ` href="#g${i + 1}"` : cyclic ? ' href="#g0"' : ''}/>`).join('')

  it('accepts a gradient chain of 8 hrefs and refuses one of 9', () => {
    check(wrap(`${gradients(9)}<rect fill="url(#g0)"/>`))
    expect(rejected(wrap(`${gradients(10)}<rect fill="url(#g0)"/>`))).toMatch(/longer than 8/)
  })

  it('refuses a cycle of gradients', () => {
    expect(rejected(wrap(`${gradients(3, true)}<rect fill="url(#g0)"/>`))).toMatch(/longer than 8, or a cycle/)
  })

  it('refuses a gradient href that is not a gradient', () => {
    rejected(wrap('<rect id="r"/><linearGradient href="#r"/>'))
  })

  it('refuses more than 1,000 references', () => {
    expect(rejected(wrap(`<rect id="s"/>${'<use href="#s"/>'.repeat(1001)}`))).toMatch(/more than 1000 references/)
    check(wrap(`<rect id="s"/>${'<use href="#s"/>'.repeat(1000)}`))
  })

  it('refuses references that add up to more than 10,000 elements', () => {
    const big = `<g id="big">${'<rect/>'.repeat(99)}</g>`
    check(wrap(`${big}${'<use href="#big"/>'.repeat(100)}`))
    expect(rejected(wrap(`${big}${'<use href="#big"/>'.repeat(101)}`))).toMatch(/add up to more than 10000/)
  })

  const grad = '<linearGradient id="g"/>'

  it.each([
    ['a pattern', '<pattern id="t"><rect/></pattern>', '<rect fill="url(#t)"/>'],
    ['a mask', '<mask id="t"><rect/></mask>', '<rect mask="url(#t)"/>'],
    ['a clip path', '<clipPath id="t"><rect/></clipPath>', '<rect clip-path="url(#t)"/>'],
    ['a symbol', '<symbol id="t"><rect/></symbol>', '<use href="#t"/>'],
    ['a group', '<g id="t"><rect/></g>', '<use href="#t"/>'],
    ['a single shape', '<rect id="t"/>', '<use href="#t"/>'],
    ['a gradient', '<linearGradient id="t"/>', '<rect fill="url(#t)"/>'],
  ])('refuses %s that sits under an element carrying a reference', (_, target, user) => {
    const message = rejected(wrap(`${grad}<g fill="url(#g)">${target}</g>${user}`))
    expect(message).toMatch(/sits under an element that carries one/)
    rejected(wrap(`${grad}<g style="stroke:url(#g)"><defs>${target}</defs></g>${user}`))
    rejected(wrap(`${grad}<g clip-path="url(#g)"><g stroke="url(#g)">${target}</g></g>${user}`))
  })

  it('refuses an element that carries a paint reference and points at a container', () => {
    const container = '<g id="c"><rect/><rect/></g>'
    expect(rejected(wrap(`${grad}${container}<use href="#c" fill="url(#g)"/>`))).toMatch(/carries other references and points at a container/)
    rejected(wrap(`${grad}${container}<use href="#c" style="stroke:url(#g)"/>`))
    rejected(`<svg ${SVG} ${XLINK}>${grad}${container}<use xlink:href="#c" clip-path="url(#g)"/></svg>`)
  })

  it('refuses an element under one that carries a reference when it points at a container', () => {
    rejected(wrap(`${grad}<g id="c"><rect/><rect/></g><g fill="url(#g)"><use href="#c"/></g>`))
    rejected(wrap(`${grad}<pattern id="p"><rect/></pattern><g stroke="url(#g)"><rect fill="url(#p)"/></g>`))
  })

  it('accepts a reference on a sibling, and plain files that use references', () => {
    check(wrap(`${grad}<rect fill="url(#g)"/><pattern id="p"><rect/></pattern><rect fill="url(#p)"/><g id="c"><rect/></g><use href="#c"/>`))
    check(wrap(`<defs><linearGradient id="g"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#000"/></linearGradient></defs><rect fill="url(#g)"/><circle fill="url(#g)" stroke="url(#g)"/><rect id="s"/><use href="#s"/><use href="#s" fill="url(#g)"/>`))
    check(wrap(`<g fill="url(#g)"><rect/><rect/></g>${grad}`))
    check(wrap(`${gradients(9)}<rect fill="url(#g0)"/>`))
  })

  it('keeps the limits at their boundaries once inherited references are counted', () => {
    check(wrap(`${grad}<g fill="url(#g)">${'<rect/>'.repeat(10)}</g>`))
    expect(rejected(wrap(`${grad}${'<rect fill="url(#g)"/>'.repeat(1001)}`))).toMatch(/more than 1000 references/)
  })

  const stopped = '<linearGradient id="g"><stop offset="0"/></linearGradient>'
  const painted = (count: number, attribute: string): string => `<g ${attribute}>${'<rect/>'.repeat(count)}</g>`

  it('charges a reference written on a container for every element it applies to', () => {
    // the gradient has two elements, so a host of N elements costs 2 x N against the limit of 10,000
    check(wrap(`${stopped}${painted(4999, 'fill="url(#g)"')}`))
    expect(rejected(wrap(`${stopped}${painted(5000, 'fill="url(#g)"')}`))).toMatch(/add up to more than 10000/)
  })

  it.each([
    ['fill in a style', 'style="fill:url(#g)"'],
    ['stroke in an attribute', 'stroke="url(#g)"'],
    ['stroke in a style', 'style="stroke:url(#g)"'],
  ])('charges %s the same way', (_, attribute) => {
    check(wrap(`${stopped}${painted(4999, attribute)}`))
    rejected(wrap(`${stopped}${painted(5000, attribute)}`))
  })

  it('charges a multi-element pattern target for every element of the host', () => {
    const pattern = '<pattern id="g"><rect/></pattern>'
    check(wrap(`${pattern}${painted(4999, 'fill="url(#g)"')}`))
    rejected(wrap(`${pattern}${painted(5000, 'fill="url(#g)"')}`))
  })

  it('charges every host of nested hosts', () => {
    const nested = (count: number): string => `<g fill="url(#g)"><g fill="url(#g)">${'<rect/>'.repeat(count)}</g></g>`
    check(wrap(`<linearGradient id="g"/>${nested(4998)}`))
    expect(rejected(wrap(`<linearGradient id="g"/>${nested(4999)}`))).toMatch(/add up to more than 10000/)
  })

  it('charges a gradient for the whole chain of gradients behind it', () => {
    const chain = Array.from({ length: 8 }, (_, i) => `<linearGradient id="c${i}" href="#c${i + 1}"/>`).join('') + '<linearGradient id="c8"><stop offset="0"/></linearGradient>'
    // the first gradient costs 10 elements (8 gradients, one with a stop) and the chain itself 9 more
    check(wrap(`${chain}${painted(998, 'fill="url(#c0)"')}`))
    expect(rejected(wrap(`${chain}${painted(999, 'fill="url(#c0)"')}`))).toMatch(/add up to more than 10000/)
  })

  it('accepts a host of one element at any depth, and small groups filled by a gradient', () => {
    check(wrap(`${stopped}<g><g><g><rect fill="url(#g)"/></g></g></g>`))
    check(wrap(`<defs>${stopped}</defs><g fill="url(#g)"><rect/><circle/><path/></g><rect fill="url(#g)" stroke="url(#g)"/>`))
  })

  it('reads deep nesting with many references in linear time', () => {
    const depth = 60
    const open = Array.from({ length: depth }, () => '<g fill="url(#g)">').join('')
    const close = '</g>'.repeat(depth)
    const fillers = '<rect id="x"/>'.repeat(40000)
    const refused = wrap(`${grad}${open}${'<rect fill="url(#g)"/>'.repeat(20000)}${fillers}${close}`)
    expect(refused.length).toBeGreaterThan(MIB / 2)
    let start = performance.now()
    rejected(refused)
    expect(performance.now() - start).toBeLessThan(1500)
    const accepted = wrap(`${grad}${open}${'<rect/>'.repeat(100)}${close}${'<rect/>'.repeat(150000)}`)
    start = performance.now()
    check(accepted)
    expect(performance.now() - start).toBeLessThan(1500)
  })

  it('checks a megabyte with many ids and references in linear time', () => {
    const ids = (count: number): string => Array.from({ length: count }, (_, i) => `<rect id="r${i}" width="1"/>`).join('')
    const uses = (count: number): string => Array.from({ length: count }, (_, i) => `<use href="#r${i}"/>`).join('')
    const refused = wrap(`${ids(8000)}${uses(8000)}${'<g/>'.repeat(60000)}`)
    expect(refused.length).toBeGreaterThan(MIB / 2)
    let start = performance.now()
    rejected(refused)
    expect(performance.now() - start).toBeLessThan(1500)
    const accepted = wrap(`${ids(900)}${uses(900)}${'<g/>'.repeat(200000)}`)
    start = performance.now()
    check(accepted)
    expect(performance.now() - start).toBeLessThan(1500)
  })
})

describe('Unicode spaces and editor attributes', () => {
  const EDITOR = 'xmlns:inkscape="http://www.inkscape.org/namespaces/inkscape" xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd"'

  it.each([['U+00A0', '\u00A0'], ['U+2028', '\u2028'], ['U+3000', '\u3000'], ['U+200B', '\u200B']])('refuses %s in a tag, an attribute position and a value', (_, space) => {
    rejected(`<svg${space}${SVG}/>`)
    rejected(`<svg ${SVG}><rect${space}width="1"/></svg>`)
    rejected(`<svg ${SVG}><rect width="1${space}"/></svg>`)
    rejected(`<svg ${SVG}><rect width${space}="1"/></svg>`)
    rejected(`<svg ${SVG}><rect style="fill:red;${space}stroke:blue"/></svg>`)
    rejected(`<svg ${SVG}><rect transform="scale(1)${space}rotate(2)"/></svg>`)
    rejected(`<svg ${SVG}><g></g${space}></svg>`)
    rejected(`<svg ${SVG}/>${space}x`)
  })

  it.each([
    ['a drive path', 'C:/Windows/Temp/x.png'],
    ['a file URL with one slash', 'file:/etc/passwd'],
    ['a URL with one slash', 'http:/evil.example/x'],
    ['a parent folder', 'a/..'],
    ['a url()', 'url(#a)'],
  ])('refuses %s in an editor attribute value', (_, value) => {
    rejected(`<svg ${SVG} ${EDITOR} inkscape:export-filename="${value}"/>`)
    rejected(`<svg ${SVG} ${EDITOR}><sodipodi:namedview sodipodi:absref="${value}"/></svg>`)
  })

  it('refuses an editor attribute that is an event handler, or sits on an element that renders', () => {
    rejected(`<svg ${SVG} ${EDITOR}><rect inkscape:onload="alert(1)"/></svg>`)
    rejected(`<svg ${SVG} ${EDITOR}><g inkscape:onclick="x"/></svg>`)
    rejected(`<svg ${SVG} ${EDITOR}><rect inkscape:label="a"/></svg>`)
    rejected(`<svg ${SVG} ${EDITOR}><g inkscape:Label="a"/></svg>`)
  })

  it('accepts editor attributes on the root, the groups, the paths and the editor elements', () => {
    check(`<svg ${SVG} ${EDITOR} inkscape:version="1.4.4 (abc, 2026-05-05)"><sodipodi:namedview id="n" inkscape:zoom="0.5"><inkscape:page id="p"/></sodipodi:namedview><g inkscape:label="Layer 1" inkscape:groupmode="layer"><path d="M0 0" sodipodi:nodetypes="cc"/></g></svg>`)
  })
})

describe('time', () => {
  const wrap = (inner: string): string => `<svg ${SVG}>${inner}</svg>`

  function timed(run: () => void): number {
    const start = performance.now()
    run()
    return performance.now() - start
  }

  it('rejects a megabyte of spaces in a style value at once', () => {
    const svg = wrap(`<rect style="fill:${' '.repeat(MIB)}!"/>`)
    let message = ''
    const elapsed = timed(() => {
      message = rejected(svg)
    })
    expect(message).toMatch(/^svg: /)
    expect(elapsed).toBeLessThan(500)
  })

  const linear: Array<[string, string]> = [
    ['tabs before a colon in a declaration', wrap(`<rect style="${'\t'.repeat(MIB)}!"/>`)],
    ['spaces before a bad name in a style', wrap(`<rect style="${' '.repeat(MIB)}#:x"/>`)],
    ['a long run of spaces between attributes', wrap(`<rect${' '.repeat(MIB)}!/>`)],
    ['a long attribute name', wrap(`<rect ${'a'.repeat(MIB)}="1"/>`)],
    ['a long attribute value', wrap(`<rect width="${'1'.repeat(MIB)}x"/>`)],
    ['a long number', wrap(`<rect width="${'1'.repeat(MIB)}"/>`)],
    ['a long run of dots in path data', wrap(`<path d="${'.'.repeat(MIB)}!"/>`)],
    ['a long transform without a close', wrap(`<g transform="${'scale('.repeat(MIB / 6)}"/>`)],
    ['repeated unterminated tags', `<svg ${SVG}>${'<g '.repeat(MIB / 3)}`],
    ['many nested openings', `<svg ${SVG}>${'<g>'.repeat(MIB / 3)}`],
    ['many declarations', wrap(`<rect style="${'fill:red;'.repeat(MIB / 9)}!"/>`)],
    ['a long comment', wrap(`<!-- ${'a'.repeat(MIB)} -->`)],
    ['a long run of dashes in a comment', wrap(`<!-- ${'-'.repeat(MIB)} -->`)],
    ['many closing tags', wrap('</g>'.repeat(MIB / 4))],
    ['many entities', wrap(`<text>${'&amp;&#1;'.repeat(MIB / 9)}</text>`)],
  ]
  it.each(linear)('reads %s in linear time', (_, svg) => {
    const elapsed = timed(() => {
      try {
        check(svg)
      } catch (error) {
        expect(error).toBeInstanceOf(UnpackError)
      }
    })
    expect(elapsed).toBeLessThan(1500)
  })

  it('accepts many small elements in linear time', () => {
    expect(timed(() => check(wrap('<g/>'.repeat(MIB / 4))))).toBeLessThan(1500)
  })

  it('reads a megabyte of JSON in linear time', () => {
    const json = Buffer.from(`["${'['.repeat(MIB)}"]`)
    expect(timed(() => checkContent('i18n/en.json', json))).toBeLessThan(1500)
  })
})
