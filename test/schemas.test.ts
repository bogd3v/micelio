import { describe, expect, it } from 'vitest'
import { changePasswordSchema, deleteAccountSchema, confirmEmailSchema, emailSchema, loginSchema, registerSchema, resetPasswordSchema } from '../server/schemas/auth'
import { guestCommentSchema } from '../server/schemas/comments'
import { subscribeSchema } from '../server/schemas/newsletter'
import { commentsQuerySchema, DEFAULT_PAGE_SIZE, listLocaleQuerySchema, localeQuerySchema, MAX_PAGE_SIZE, postParamsSchema, postsQuerySchema, readingPathQuerySchema, searchQuerySchema } from '../server/schemas/query'
import { COMMENT_LIMITS } from '../app/constants/comments'

describe('auth schemas', () => {
  it('trims the login identifier and keeps the password as typed', () => {
    expect(loginSchema.parse({ identifier: '  lectora ', password: ' secreto ' })).toEqual({ identifier: 'lectora', password: ' secreto ' })
    expect(loginSchema.safeParse({ identifier: '   ', password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ identifier: 'lectora' }).success).toBe(false)
  })

  it('accepts a registration only with valid fields and the privacy notice accepted', () => {
    const valid = { username: 'lectora', email: ' Lectora@Example.com ', password: 'una-clave-larga', acceptPrivacy: true }
    expect(registerSchema.parse({ ...valid, role: 'admin' })).toEqual({ username: 'lectora', email: 'lectora@example.com', password: 'una-clave-larga', acceptPrivacy: true })
    for (const body of [
      { ...valid, acceptPrivacy: 'true' },
      { ...valid, acceptPrivacy: false },
      { ...valid, username: 'a b' },
      { ...valid, email: 'not-an-email' },
      { ...valid, password: 'corta' },
    ]) {
      expect(registerSchema.safeParse(body).success).toBe(false)
    }
  })

  it('normalizes the email of password and confirmation requests', () => {
    expect(emailSchema.parse({ email: ' Ana@Example.com ' })).toEqual({ email: 'ana@example.com' })
    expect(emailSchema.safeParse({ email: 42 }).success).toBe(false)
  })

  it('requires a code and two matching valid passwords to reset', () => {
    const valid = { code: 'abc', password: 'una-clave-larga', passwordConfirmation: 'una-clave-larga' }
    expect(resetPasswordSchema.safeParse(valid).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ ...valid, passwordConfirmation: 'otra-clave-larga' }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ ...valid, code: '' }).success).toBe(false)
  })

  it('requires the username and password to delete the account', () => {
    expect(deleteAccountSchema.safeParse({ username: 'lectora', password: 'x' }).success).toBe(true)
    expect(deleteAccountSchema.safeParse({ username: 'lectora' }).success).toBe(false)
  })
})

describe('subscribeSchema', () => {
  it('normalizes the email and maps the locale to a newsletter language', () => {
    expect(subscribeSchema.parse({ email: ' Ana@Example.com ', locale: 'es' })).toEqual({ email: 'ana@example.com', locale: 'es' })
    expect(subscribeSchema.parse({ email: 'ana@example.com', locale: 'fr' }).locale).toBe('en')
    expect(subscribeSchema.parse({ email: 'ana@example.com' }).locale).toBe('en')
  })

  it('tells a missing email from an invalid one', () => {
    for (const body of [{}, { email: '' }, { email: 42 }]) {
      expect(subscribeSchema.safeParse(body).error?.issues[0]?.message).toBe('Email is required')
    }
    for (const body of [{ email: 'not-an-email' }, { email: `${'a'.repeat(250)}@b.co` }]) {
      expect(subscribeSchema.safeParse(body).error?.issues[0]?.message).toBe('Invalid email format')
    }
  })
})

describe('guestCommentSchema', () => {
  const valid = { author: { name: ' Ana ', email: 'Ana@Example.com' }, content: ' Hola ' }

  it('keeps only the allowed fields', () => {
    const result = guestCommentSchema.parse({ ...valid, approvalStatus: 'APPROVED', isAdminComment: true, author: { ...valid.author, id: 'admin' } })
    expect(result).toEqual({ author: { name: 'Ana', email: 'ana@example.com', avatar: undefined }, content: 'Hola', locale: undefined })
  })

  it('keeps an http(s) avatar and a numeric parent, and drops other avatars', () => {
    expect(guestCommentSchema.parse({ ...valid, author: { ...valid.author, avatar: 'https://example.com/a.png' }, threadOf: 7 })).toMatchObject({
      author: { avatar: 'https://example.com/a.png' },
      threadOf: 7,
    })
    expect(guestCommentSchema.parse({ ...valid, author: { ...valid.author, avatar: 'javascript:alert(1)' } }).author.avatar).toBeUndefined()
  })

  it('rejects missing, invalid or oversized fields', () => {
    for (const body of [
      {},
      { ...valid, content: '   ' },
      { ...valid, author: { name: 'Ana' } },
      { ...valid, author: { name: 'Ana', email: 'not-an-email' } },
      { ...valid, author: { name: 'x'.repeat(COMMENT_LIMITS.name + 1), email: 'a@b.co' } },
      { ...valid, content: 'x'.repeat(COMMENT_LIMITS.content + 1) },
      { ...valid, threadOf: '7' },
      { ...valid, threadOf: 0 },
    ]) {
      expect(guestCommentSchema.safeParse(body).success).toBe(false)
    }
  })
})

describe('query schemas', () => {
  it('reads the posts query with defaults and caps the page size', () => {
    expect(postsQuerySchema.parse({})).toEqual({ page: 1, pageSize: DEFAULT_PAGE_SIZE, sort: 'recent', content: false })
    expect(postsQuerySchema.parse({ page: '3', pageSize: '10000', locale: 'es', category: ' Software ', tag: 'vue', search: ' composables ', sort: 'OLDEST', content: '1' })).toEqual({
      page: 3,
      pageSize: MAX_PAGE_SIZE,
      locale: 'es',
      category: 'software',
      tag: 'vue',
      search: 'composables',
      sort: 'oldest',
      content: true,
    })
    expect(postsQuerySchema.parse({ page: '', pageSize: '', locale: '', category: '', search: '' })).toMatchObject({ page: 1, pageSize: DEFAULT_PAGE_SIZE })
  })

  it('rejects a bad page, an unknown locale or sort, arrays and slugs that are not slugs', () => {
    for (const query of [
      { page: '0' }, { page: '-1' }, { page: 'abc' }, { pageSize: '1.5' }, { pageSize: 'NaN' }, { pageSize: '1e3' }, { page: ['1', '2'] },
      { locale: 'fr' }, { locale: ['en', 'es'] }, { category: 'a b' }, { tag: ['vue', 'ts'] }, { search: 'x'.repeat(201) },
    ]) {
      expect(postsQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false)
    }
  })

  it('falls back to the newest first order for an unknown sort', () => {
    expect(postsQuerySchema.parse({ sort: 'popular' }).sort).toBe('recent')
    expect(postsQuerySchema.parse({ sort: ['oldest'] }).sort).toBe('recent')
  })

  it('keeps the error messages the routes used to send', () => {
    expect(postsQuerySchema.safeParse({ page: 'abc' }).error?.issues[0]?.message).toBe('Invalid pagination')
    expect(localeQuerySchema.safeParse({ locale: 'fr' }).error?.issues[0]?.message).toBe('Unsupported locale')
    expect(readingPathQuerySchema.safeParse({ category: 'not a slug' }).error?.issues[0]?.message).toBe('Unknown category')
  })

  it('defaults the category and tag lists to English', () => {
    expect(listLocaleQuerySchema.parse({})).toEqual({ locale: 'en' })
    expect(listLocaleQuerySchema.parse({ locale: 'es' })).toEqual({ locale: 'es' })
  })

  it('reads the palette search and the reading path', () => {
    expect(searchQuerySchema.parse({ q: ' vue ', locale: 'en', content: 'true' })).toEqual({ q: 'vue', locale: 'en', content: true })
    expect(searchQuerySchema.parse({})).toEqual({ q: '', content: false })
    expect(readingPathQuerySchema.parse({ category: ' Software ' })).toEqual({ category: 'software' })
    // Existence is checked against the CMS list in the route, so the schema accepts any slug shape
    expect(readingPathQuerySchema.parse({ category: 'garden' })).toEqual({ category: 'garden' })
  })

  it('accepts only a field:direction sort and capped pagination for comments', () => {
    expect(commentsQuerySchema.parse({ sort: 'createdAt:desc', pageSize: '500' })).toEqual({ sort: 'createdAt:desc', pageSize: MAX_PAGE_SIZE })
    expect(commentsQuerySchema.parse({})).toEqual({})
    for (const query of [{ sort: 'createdAt;drop' }, { sort: 'createdAt' }, { page: '0' }, { locale: 'fr' }]) {
      expect(commentsQuerySchema.safeParse(query).success, JSON.stringify(query)).toBe(false)
    }
  })
})

describe('postParamsSchema', () => {
  it('accepts the slugs Strapi makes for a uid, in either case', () => {
    for (const slug of ['understanding-vue-composables', 'Guide_v2.1~x', 'a', '2026-recap', 'b'.repeat(256)]) {
      expect(postParamsSchema.safeParse({ slug }).success, slug).toBe(true)
    }
  })

  it('refuses anything else', () => {
    for (const slug of ['', '-a', 'a b', 'a/b', '../x', '<script>', 'a\u0000b', 'é', 'b'.repeat(257), undefined, 12]) {
      expect(postParamsSchema.safeParse({ slug }).success, String(slug)).toBe(false)
    }
  })
})

describe('auth schemas, upper bounds', () => {
  const long = 'a'.repeat(73)
  const email = `${'a'.repeat(250)}@example.com`

  it('refuse a new password of more than 72 bytes where one is set', () => {
    expect(registerSchema.safeParse({ username: 'lectora', email: 'lectora@example.com', password: long, acceptPrivacy: true }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ code: 'abcdef0123456789', password: long, passwordConfirmation: long }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'la-actual-1', password: long, passwordConfirmation: long }).success).toBe(false)
    expect(registerSchema.safeParse({ username: 'lectora', email: 'lectora@example.com', password: 'a'.repeat(72), acceptPrivacy: true }).success).toBe(true)
  })

  it('refuse an identifier, an email or a username of more than 254 characters', () => {
    expect(loginSchema.safeParse({ identifier: 'a'.repeat(255), password: 'x' }).success).toBe(false)
    expect(loginSchema.safeParse({ identifier: 'a'.repeat(254), password: 'x' }).success).toBe(true)
    expect(emailSchema.safeParse({ email }).success).toBe(false)
    expect(registerSchema.safeParse({ username: 'lectora', email, password: 'a'.repeat(20), acceptPrivacy: true }).success).toBe(false)
    expect(deleteAccountSchema.safeParse({ username: 'a'.repeat(255), password: 'x' }).success).toBe(false)
  })

  it('refuse a password typed into a sign-in or delete form that is absurdly long', () => {
    expect(loginSchema.safeParse({ identifier: 'lectora', password: 'x'.repeat(1025) }).success).toBe(false)
    expect(deleteAccountSchema.safeParse({ username: 'lectora', password: 'x'.repeat(1025) }).success).toBe(false)
    expect(changePasswordSchema.safeParse({ currentPassword: 'x'.repeat(1025), password: 'una-frase-larga-1', passwordConfirmation: 'una-frase-larga-1' }).success).toBe(false)
  })

  it('accept only a reset code made of the characters the CMS uses, and of a sane length', () => {
    const good = { password: 'una-frase-larga-1', passwordConfirmation: 'una-frase-larga-1' }
    expect(resetPasswordSchema.safeParse({ ...good, code: 'a'.repeat(128) }).success).toBe(true)
    expect(resetPasswordSchema.safeParse({ ...good, code: 'a'.repeat(1000) }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ ...good, code: 'abc def' }).success).toBe(false)
    expect(resetPasswordSchema.safeParse({ ...good, code: '<script>' }).success).toBe(false)
  })
})

describe('confirmEmailSchema', () => {
  it('takes the 40 lowercase hexadecimal characters of the CMS and nothing else', () => {
    const token = 'a1'.repeat(20)
    expect(confirmEmailSchema.parse({ confirmation: token })).toEqual({ confirmation: token })
    for (const confirmation of [token.slice(1), `${token}0`, token.toUpperCase(), `${token.slice(1)}g`, ` ${token}`, '', 42, null]) {
      expect(confirmEmailSchema.safeParse({ confirmation }).success).toBe(false)
    }
    expect(confirmEmailSchema.safeParse({}).success).toBe(false)
  })
})
