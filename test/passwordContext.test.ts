import { describe, expect, it } from 'vitest'
import { passwordContextWords, passwordUsesContext } from '../app/helpers/passwordContext'

const words = passwordContextWords({ username: 'lectora.ana', email: 'Ana.Garcia+blog@example.com', siteName: 'Micelio Blog' })

describe('passwordContextWords', () => {
  it('lists the username, the parts of the email address before the @ and the words of the site name, in lower case', () => {
    expect(words).toEqual(expect.arrayContaining(['lectora.ana', 'lectora', 'ana.garcia+blog', 'garcia', 'blog', 'micelio blog', 'micelio']))
  })

  it('leaves out anything shorter than four characters, so a short word does not block half the passwords', () => {
    expect(words).not.toContain('ana')
    expect(passwordContextWords({ username: 'abc', email: 'jo@example.com', siteName: 'Go' })).toEqual([])
  })

  it('is empty without context', () => {
    expect(passwordContextWords({})).toEqual([])
  })
})

describe('passwordUsesContext', () => {
  it.each([
    'lectora-segura-1',
    'MiCeLiO-es-genial-1',
    'frase con garcia dentro',
    'Mi-Garcia-y-su-perro',
    'un-blog-cualquiera-2',
    'Lectóra-con-tilde-9',
    'mi.celio.fan.club.1',
  ])('refuses %s', (password) => {
    expect(passwordUsesContext(password, words)).toBe(true)
  })

  it.each([
    'una-frase-larga-y-segura',
    'correcto caballo bateria grapa',
    'ana-no-cuenta-porque-es-corta',
  ])('accepts %s', (password) => {
    expect(passwordUsesContext(password, words)).toBe(false)
  })

  it('accepts anything when there are no words', () => {
    expect(passwordUsesContext('lectora-segura-1', [])).toBe(false)
  })
})
