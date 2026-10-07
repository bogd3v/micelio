import { describe, expect, it } from 'vitest'
import { excerptSegments, plainText } from '~/helpers/excerpt'

describe('excerptSegments', () => {
  it('keeps the text around <mark> and flags the matches', () => {
    expect(excerptSegments('A <mark>composable</mark> is a recipe')).toEqual([
      { text: 'A ', match: false },
      { text: 'composable', match: true },
      { text: ' is a recipe', match: false },
    ])
  })

  it('drops every other tag and keeps its text', () => {
    expect(excerptSegments('<p onclick="x()">Hi <b>there</b><script>alert(1)</script><img src=x onerror=y> <mark class="z">vue</mark></p>')).toEqual([
      { text: 'Hi therealert(1) ', match: false },
      { text: 'vue', match: true },
    ])
  })

  it('decodes entities once and never turns them into markup', () => {
    const [segment] = excerptSegments('&lt;script&gt;alert(1)&lt;/script&gt; &amp;amp; &#39;q&#39; &#x41; &nbsp;&unknown; &#0;')
    expect(segment?.text).toBe('<script>alert(1)</script> &amp; \'q\' A  &unknown; &#0;')
    expect(excerptSegments('&lt;mark&gt;x&lt;/mark&gt;')).toEqual([{ text: '<mark>x</mark>', match: false }])
  })

  it('keeps a lone < that is not a tag', () => {
    expect(excerptSegments('1 < 2 and <mark>3</mark> > 2')).toEqual([
      { text: '1 < 2 and ', match: false },
      { text: '3', match: true },
      { text: ' > 2', match: false },
    ])
  })

  it('treats an unclosed <mark> as a match to the end', () => {
    expect(excerptSegments('a <MARK>b')).toEqual([{ text: 'a ', match: false }, { text: 'b', match: true }])
  })

  it('returns nothing for an empty excerpt', () => {
    expect(excerptSegments('')).toEqual([])
    expect(excerptSegments('<mark></mark>')).toEqual([])
  })
})

describe('plainText', () => {
  it('decodes entities and drops tags of a title', () => {
    expect(plainText('Q&amp;A &lt;b&gt; <i>with</i> tags')).toBe('Q&A <b> with tags')
    expect(plainText('')).toBe('')
  })
})
