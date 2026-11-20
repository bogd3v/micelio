import { describe, expect, it } from 'vitest'
import { faqStructuredData, jsonLd } from '../app/helpers/faqStructuredData'
import type { FaqItem, PageSection } from '../app/interfaces'

function faq(...items: FaqItem[]): PageSection {
  return { __component: 'section.faq', variant: 'list', title: 'Questions', items }
}

const hero: PageSection = { __component: 'section.hero', variant: 'centered', title: 'Hi' }

describe('faqStructuredData', () => {
  it('a page with two faq blocks emits one FAQPage with every question', () => {
    const data = faqStructuredData([
      faq({ question: 'Do I need a garden?', html: '<p>No: a balcony is enough.</p>' }),
      hero,
      faq({ question: 'Is this site real?', html: '<p>It is a demo.</p>' }, { question: 'When do I plant?', html: '<p>After the last frost.</p>' }),
    ])
    expect(data).toEqual({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      'mainEntity': [
        { '@type': 'Question', 'name': 'Do I need a garden?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'No: a balcony is enough.' } },
        { '@type': 'Question', 'name': 'Is this site real?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'It is a demo.' } },
        { '@type': 'Question', 'name': 'When do I plant?', 'acceptedAnswer': { '@type': 'Answer', 'text': 'After the last frost.' } },
      ],
    })
  })

  it('an answer\'s Markdown becomes plain text', () => {
    const html = '<p>Use <strong>warm</strong> soil &amp; <a href="https://example.test/x">a pot</a>.</p>\n<ul><li>One</li><li>Two</li></ul><p>Done<br>now</p>'
    const text = faqStructuredData([faq({ question: 'How?', html })])!.mainEntity[0]!.acceptedAnswer.text
    expect(text).toBe('Use warm soil & a pot. One Two Done now')
    expect(text).not.toMatch(/[<>]/)
  })

  it('emits nothing for a page with no question that has an answer', () => {
    expect(faqStructuredData(undefined)).toBeUndefined()
    expect(faqStructuredData([hero])).toBeUndefined()
    expect(faqStructuredData([faq({ question: 'Empty?', html: '<p> </p>' }, { question: ' ', html: '<p>No question.</p>' })])).toBeUndefined()
  })

  it('keeps an answer from closing the script that carries it', () => {
    const data = faqStructuredData([faq({ question: 'Code?', html: '<p>&lt;/script&gt;&lt;script&gt;alert(1)&lt;/script&gt;</p>' })])!
    expect(data.mainEntity[0]!.acceptedAnswer.text).toBe('</script><script>alert(1)</script>')
    const json = jsonLd(data)
    expect(json).not.toContain('<')
    expect(JSON.parse(json)).toEqual(data)
  })
})
