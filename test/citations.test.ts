import { describe, it, expect } from 'vitest'
import {
  apaText,
  buildCitationIndex,
  citationOrder,
  citedKeys,
  formatAccessDate,
  formatApa,
  latestAccessedAt,
  numberReferences,
  referenceIdentifier,
  referenceLang,
  referenceVenue,
} from '../app/helpers/citations'
import type { StrapiBlock } from '../app/interfaces/strapi-blocks'
import type { StrapiReference } from '../app/interfaces/strapi-reference'

const ji: StrapiReference = {
  key: 'ji-2023',
  type: 'journal',
  authors: 'Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., et al.',
  year: '2023',
  title: 'Survey of Hallucination in Natural Language Generation',
  container: 'ACM Computing Surveys',
  volume: '55',
  issue: '12',
  doi: '10.1145/3571730',
  accessedAt: '2026-09-11',
}

const lewis: StrapiReference = {
  key: 'lewis-2020',
  type: 'conference',
  authors: 'Lewis, P., Perez, E., Piktus, A., et al.',
  year: '2020',
  title: 'Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks',
  container: 'Advances in Neural Information Processing Systems',
  venueLabel: 'NeurIPS 2020',
  url: 'https://arxiv.org/abs/2005.11401',
  accessedAt: '2026-09-02',
}

const docs: StrapiReference = {
  key: 'marked-docs',
  type: 'docs',
  authors: 'Marked contributors',
  year: 's. f.',
  title: 'Extensibility',
  container: 'Marked Documentation',
  url: 'https://marked.js.org/using_pro/',
}

const references = [ji, lewis, docs]

const blocks = [
  { id: 1, __component: 'shared.rich-text', body: 'RAG [@lewis-2020] fails [@ji-2023; @lewis-2020].' },
  { id: 2, __component: 'shared.media', file: { url: '/a.png' } },
  { id: 3, __component: 'shared.quote', body: 'Again [@ji-2023] and [@missing].' },
] as StrapiBlock[]

describe('citedKeys', () => {
  it('reads single and grouped citations in order', () => {
    expect(citedKeys('A [@a] b [@b; @c] c [@a]')).toEqual(['a', 'b', 'c', 'a'])
  })

  it('ignores code, links and malformed keys', () => {
    const markdown = '`[@inline]`\n\n```\n[@fenced]\n```\n\n[@handle](https://mastodon.social/@handle) [@Upper] [@ok]'
    expect(citedKeys(markdown)).toEqual(['ok'])
  })
})

describe('citationOrder', () => {
  it('numbers keys by first appearance across rich text and quote blocks', () => {
    expect(citationOrder(blocks, references)).toEqual(['lewis-2020', 'ji-2023'])
  })

  it('skips keys without a reference', () => {
    expect(citationOrder(blocks, [ji])).toEqual(['ji-2023'])
  })
})

describe('numberReferences', () => {
  it('lists cited references first and uncited ones after them', () => {
    expect(numberReferences(blocks, references).map(entry => [entry.number, entry.reference.key, entry.cited])).toEqual([
      [1, 'lewis-2020', true],
      [2, 'ji-2023', true],
      [3, 'marked-docs', false],
    ])
  })

  it('returns nothing without references', () => {
    expect(numberReferences(blocks, null)).toEqual([])
  })
})

describe('buildCitationIndex', () => {
  it('anchors each key in the block where it first appears', () => {
    expect(buildCitationIndex(blocks, references)).toEqual({
      numbers: { 'lewis-2020': 1, 'ji-2023': 2 },
      anchors: { 'shared.rich-text-1': ['lewis-2020', 'ji-2023'] },
    })
  })
})

describe('formatApa', () => {
  it('links the title to the DOI and italicises the journal', () => {
    expect(formatApa(ji)).toEqual([
      { kind: 'text', text: 'Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., et al. (2023). ' },
      { kind: 'title', text: 'Survey of Hallucination in Natural Language Generation', href: 'https://doi.org/10.1145/3571730' },
      { kind: 'text', text: '.' },
      { kind: 'text', text: ' ' },
      { kind: 'container', text: 'ACM Computing Surveys' },
      { kind: 'text', text: ', 55(12).' },
    ])
  })

  it('links the title to the URL when there is no DOI', () => {
    expect(formatApa(lewis)[1]).toEqual({ kind: 'title', text: lewis.title, href: 'https://arxiv.org/abs/2005.11401' })
    expect(apaText(lewis)).toBe('Lewis, P., Perez, E., Piktus, A., et al. (2020). Retrieval-Augmented Generation for Knowledge-Intensive NLP Tasks. Advances in Neural Information Processing Systems.')
  })

  it('omits volume, issue and pages when missing and keeps a plain container for docs', () => {
    expect(formatApa(docs).find(segment => segment.kind === 'container')).toBeUndefined()
    expect(apaText(docs)).toBe('Marked contributors (s. f.). Extensibility. Marked Documentation.')
  })

  it('adds pages and does not double the closing punctuation', () => {
    const reference = { ...ji, title: 'Is RAG enough?', volume: null, pages: '1–38' }
    expect(apaText(reference)).toBe('Ji, Z., Lee, N., Frieske, R., Yu, T., Su, D., Xu, Y., et al. (2023). Is RAG enough? ACM Computing Surveys, (12), 1–38.')
  })

  it('leaves the title unlinked without DOI or URL', () => {
    expect(formatApa({ ...docs, url: null })[1]).toEqual({ kind: 'title', text: 'Extensibility', href: undefined })
  })
})

describe('referenceIdentifier', () => {
  it('shows the DOI, the arXiv id or the bare URL', () => {
    expect(referenceIdentifier(ji)).toEqual({ text: 'doi.org/10.1145/3571730', href: 'https://doi.org/10.1145/3571730' })
    expect(referenceIdentifier(lewis)).toEqual({ text: 'arXiv:2005.11401', href: 'https://arxiv.org/abs/2005.11401' })
    expect(referenceIdentifier(docs)).toEqual({ text: 'marked.js.org/using_pro', href: 'https://marked.js.org/using_pro/' })
    expect(referenceIdentifier({ ...docs, url: null })).toBeNull()
  })
})

describe('referenceVenue', () => {
  it('uses the venue label or builds it from container and year', () => {
    expect(referenceVenue(lewis)).toBe('NEURIPS 2020')
    expect(referenceVenue(ji)).toBe('ACM COMPUTING SURVEYS · 2023')
  })
})

describe('access date', () => {
  it('picks the latest date and formats it as a dotted date without shifting the day', () => {
    const latest = latestAccessedAt(references)
    expect(latest).toBe('2026-09-11')
    expect(formatAccessDate(latest!)).toBe('11.09.2026')
    expect(formatAccessDate('2026-01-01')).toBe('01.01.2026')
    expect(latestAccessedAt([docs])).toBeNull()
  })
})

describe('referenceLang', () => {
  const base: StrapiReference = { key: 'k', type: 'web', authors: 'A', year: '2024', title: 'T' }

  it('returns the language when it differs from the locale', () => {
    expect(referenceLang({ ...base, language: 'en' }, 'es')).toBe('en')
    expect(referenceLang({ ...base, language: 'en-GB' }, 'es')).toBe('en-GB')
  })

  it('returns undefined when it is absent, empty or the locale itself', () => {
    expect(referenceLang(base, 'es')).toBeUndefined()
    expect(referenceLang({ ...base, language: null }, 'es')).toBeUndefined()
    expect(referenceLang({ ...base, language: ' ' }, 'es')).toBeUndefined()
    expect(referenceLang({ ...base, language: 'ES' }, 'es')).toBeUndefined()
    expect(referenceLang({ ...base, language: 'es-CO' }, 'es')).toBeUndefined()
  })
})
