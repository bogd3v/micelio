import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { addressOf, blockElements, boxOfPointer, collectBlocks, findBlock, itemElements, placeGap, pointedAt } from '~/helpers/previewBlocks'

const VERSION = 'v1'
let zone: HTMLElement

function size(element: Element, left: number, top: number, width: number, height: number): void {
  element.getBoundingClientRect = (): DOMRect => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) })
}

beforeEach(() => {
  document.body.innerHTML = `
    <div data-myc-zone="sections">
      <section data-section="title"><h1>Title</h1></section>
      <section data-myc-block="hero" data-myc-index="0"><h2>Hero</h2></section>
      <section data-myc-block="feature-grid" data-myc-index="1">
        <ul class="myc-section-items">
          <li class="myc-section-item"><h3>One</h3></li>
          <li class="myc-section-item"><h3>Two</h3></li>
        </ul>
        <ul class="myc-section-items" aria-hidden="true"><li class="myc-section-item">copy</li></ul>
      </section>
      <section data-myc-block="cta" data-myc-index="2"><div data-myc-block="nested" data-myc-index="0"></div></section>
    </div>`
  zone = document.querySelector('[data-myc-zone]')!
})

afterEach(() => {
  document.body.innerHTML = ''
})

describe('the geometry of the zone', () => {
  it('finds the blocks that are direct children of the zone', () => {
    expect(blockElements(zone).map(element => element.getAttribute('data-myc-block'))).toEqual(['hero', 'feature-grid', 'cta'])
  })

  it('lists the items of a block in order and leaves the aria-hidden copies out', () => {
    const grid = zone.querySelector<HTMLElement>('[data-myc-block="feature-grid"]')!
    expect(itemElements(grid).map(item => item.textContent?.trim())).toEqual(['One', 'Two'])
  })

  it('reports each block and each item with its box in document coordinates', () => {
    const [hero, grid, cta] = blockElements(zone)
    size(hero!, 0, 100, 800, 300)
    size(grid!, 0, 400, 800, 500)
    size(cta!, 0, 900, 800, 200)
    const [one, two] = itemElements(grid!)
    size(one!, 10, 420, 380.04, 200)
    size(two!, 410, 420, 380, 200)
    const blocks = collectBlocks(zone, VERSION, { x: 0, y: 50 })
    expect(blocks.map(block => block.address)).toEqual([
      { zone: 'sections', index: 0, block: 'hero', version: VERSION },
      { zone: 'sections', index: 1, block: 'feature-grid', version: VERSION },
      { zone: 'sections', index: 2, block: 'cta', version: VERSION },
    ])
    expect(blocks[0]!.box).toEqual({ x: 0, y: 150, width: 800, height: 300 })
    expect(blocks[0]!.items).toEqual([])
    expect(blocks[1]!.items).toEqual([
      { index: 0, box: { x: 10, y: 470, width: 380, height: 200 } },
      { index: 1, box: { x: 410, y: 470, width: 380, height: 200 } },
    ])
  })

  it('skips a block whose marker is not a position', () => {
    zone.querySelector('[data-myc-block="cta"]')!.setAttribute('data-myc-index', 'x')
    expect(collectBlocks(zone, VERSION, { x: 0, y: 0 }).map(block => block.address.block)).toEqual(['hero', 'feature-grid'])
    expect(addressOf(document.createElement('div'), VERSION)).toBeUndefined()
  })

  it('answers the box of a block, of one of its items, and null for what is not there', () => {
    const grid = findBlock(zone, { zone: 'sections', index: 1, block: 'feature-grid', version: VERSION })!
    size(grid, 0, 400, 800, 500)
    size(itemElements(grid)[1]!, 410, 420, 380, 200)
    const address = addressOf(grid, VERSION)!
    expect(boxOfPointer(zone, address, null, { x: 0, y: 0 })).toEqual({ x: 0, y: 400, width: 800, height: 500 })
    expect(boxOfPointer(zone, address, 1, { x: 0, y: 0 })).toEqual({ x: 410, y: 420, width: 380, height: 200 })
    expect(boxOfPointer(zone, address, 5, { x: 0, y: 0 })).toBeNull()
    expect(boxOfPointer(zone, null, null, { x: 0, y: 0 })).toBeNull()
    expect(boxOfPointer(zone, { ...address, block: 'hero' }, null, { x: 0, y: 0 })).toBeNull()
    expect(findBlock(zone, { ...address, index: 7 })).toBeUndefined()
  })
})

describe('what is under the pointer', () => {
  it('names the block and the item', () => {
    const heading = zone.querySelector('[data-myc-block="feature-grid"] li:nth-child(2) h3')
    expect(pointedAt(zone, heading, VERSION)).toEqual({ address: { zone: 'sections', index: 1, block: 'feature-grid', version: VERSION }, item: 1 })
    expect(pointedAt(zone, zone.querySelector('h2'), VERSION)).toMatchObject({ address: { block: 'hero' }, item: null })
  })

  it('names nothing outside a block of the zone', () => {
    expect(pointedAt(zone, zone.querySelector('h1'), VERSION)).toBeUndefined()
    expect(pointedAt(zone, null, VERSION)).toBeUndefined()
    expect(pointedAt(zone, document, VERSION)).toBeUndefined()
    // a marked element inside a block is not a block of the zone: the pointer names the block that holds it only if that one is a direct child
    expect(pointedAt(zone, zone.querySelector('[data-myc-block="nested"]'), VERSION)).toBeUndefined()
  })
})

describe('the gap', () => {
  const gaps = (): HTMLElement[] => [...zone.querySelectorAll<HTMLElement>('[data-myc-gap]')]

  it('opens after a block, hidden from assistive technology, with the height asked', () => {
    placeGap(zone, 0, 48)
    expect(gaps()).toHaveLength(1)
    expect(gaps()[0]!.previousElementSibling?.getAttribute('data-myc-block')).toBe('hero')
    expect(gaps()[0]!.nextElementSibling?.getAttribute('data-myc-block')).toBe('feature-grid')
    expect(gaps()[0]!.style.height).toBe('48px')
    expect(gaps()[0]!.getAttribute('aria-hidden')).toBe('true')
    expect(gaps()[0]!.hasAttribute('style')).toBe(true)
  })

  it('moves to the new place and never leaves two', () => {
    placeGap(zone, 0, 48)
    placeGap(zone, 2, 20)
    expect(gaps()).toHaveLength(1)
    expect(gaps()[0]!.previousElementSibling?.getAttribute('data-myc-block')).toBe('cta')
    expect(gaps()[0]!.style.height).toBe('20px')
  })

  it('opens at the top of the zone for null, before the first block', () => {
    placeGap(zone, null, 30)
    expect(gaps()[0]!.nextElementSibling?.getAttribute('data-myc-block')).toBe('hero')
  })

  it('closes with height 0 and does nothing for a position with no block', () => {
    placeGap(zone, 1, 48)
    placeGap(zone, 1, 0)
    expect(gaps()).toHaveLength(0)
    placeGap(zone, 9, 48)
    expect(gaps()).toHaveLength(0)
    // a position with no block leaves the gap that is open where it is
    placeGap(zone, 0, 48)
    placeGap(zone, 9, 20)
    expect(gaps()).toHaveLength(1)
    expect(gaps()[0]!.previousElementSibling?.getAttribute('data-myc-block')).toBe('hero')
    expect(gaps()[0]!.style.height).toBe('48px')
  })

  it('is not a block, so the report does not count it', () => {
    placeGap(zone, 0, 48)
    expect(blockElements(zone)).toHaveLength(3)
  })
})
