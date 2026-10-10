import { describe, it, expect } from 'vitest'
import { ARTICLE_POPULATE } from '../server/lib/constants'
import { isRunnable, playgroundLanguage, playgroundText } from '../app/helpers/playground'

describe('article populate', () => {
  it('requests the playground block whole, since Strapi drops components a fragment does not name', () => {
    expect(ARTICLE_POPULATE.blocks.on['shared.playground']).toBe(true)
  })
})

describe('playground helpers', () => {
  it('names the three runtimes and passes any other value through', () => {
    expect(playgroundLanguage('sql')).toBe('SQL')
    expect(playgroundLanguage('python')).toBe('Python')
    expect(playgroundLanguage('javascript')).toBe('JavaScript')
    expect(playgroundLanguage('cobol')).toBe('cobol')
  })

  it('runs only known runtimes, not inherited object keys', () => {
    expect(isRunnable({ runtime: 'python' })).toBe(true)
    expect(isRunnable({ runtime: 'cobol' })).toBe(false)
    expect(isRunnable({ runtime: 'constructor' })).toBe(false)
  })

  it('treats blank text as absent and drops trailing newlines', () => {
    expect(playgroundText(undefined)).toBe('')
    expect(playgroundText(null)).toBe('')
    expect(playgroundText(' \n')).toBe('')
    expect(playgroundText('a\nb\n\n')).toBe('a\nb')
  })
})
