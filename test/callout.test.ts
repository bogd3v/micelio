import { describe, it, expect } from 'vitest'
import { parseCalloutMarker, renderCalloutHtml } from '../app/helpers/callout'
import { mastodonShareUrl } from '../app/helpers/share'

describe('parseCalloutMarker', () => {
  it('reads the GitHub alert marker and an optional title', () => {
    expect(parseCalloutMarker('[!NOTE] Analogía\nUn LLM sin RAG…')).toEqual({ tone: 'note', title: 'Analogía', body: 'Un LLM sin RAG…' })
    expect(parseCalloutMarker('[!warning]\nCuidado')).toEqual({ tone: 'warning', title: undefined, body: 'Cuidado' })
    expect(parseCalloutMarker('[!CAUTION]\nNo')!.tone).toBe('danger')
  })

  it('ignores plain quotes and unknown markers', () => {
    expect(parseCalloutMarker('Una cita normal')).toBeNull()
    expect(parseCalloutMarker('[!OTHER] x')).toBeNull()
  })
})

describe('renderCalloutHtml', () => {
  it('mirrors MycCallout and escapes the heading', () => {
    const html = renderCalloutHtml('danger', '<b>Ojo</b>', '<p>Texto</p>')
    expect(html).toContain('class="myc-callout myc-callout-danger not-prose" role="alert"')
    expect(html).toContain('<span aria-hidden="true">✕ </span>&lt;b&gt;Ojo&lt;/b&gt;')
    expect(html).toContain('<div class="myc-callout-body"><p>Texto</p></div>')
  })
})

describe('mastodonShareUrl', () => {
  it('shares the title and the link through Share₂Fedi', () => {
    expect(mastodonShareUrl('RAG & más', 'https://bogdev.com.co/blog/rag')).toBe(
      'https://s2f.kytta.dev/?text=RAG%20%26%20m%C3%A1s%20https%3A%2F%2Fbogdev.com.co%2Fblog%2Frag',
    )
  })
})
