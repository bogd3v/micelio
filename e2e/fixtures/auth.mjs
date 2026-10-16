import { createHash } from 'node:crypto'

export const testUsers = {
  reader: { username: 'lectora', email: 'lectora@example.com', password: 'lectora-segura-1' },
  editor: { username: 'alejandro', email: 'alejandro@example.com', password: 'editor-seguro-1' },
  unconfirmed: { username: 'pendiente', email: 'pendiente@example.com', password: 'pendiente-segura-1' },
  rateLimited: { username: 'limite', email: 'limite@example.com', password: 'limite-segura-1' },
}

const JWT_PREFIX = 'mock-jwt-'

function seedUsers() {
  return [
    { id: 101, ...testUsers.reader, confirmed: true, role: 'authenticated', createdAt: '2026-09-29T15:00:00.000Z' },
    { id: 102, ...testUsers.editor, confirmed: true, role: 'editor', createdAt: '2026-01-15T15:00:00.000Z' },
    { id: 103, ...testUsers.unconfirmed, confirmed: false, role: 'authenticated', createdAt: '2026-09-30T15:00:00.000Z' },
  ]
}

function strapiError(status, name, message) {
  return { status, body: { data: null, error: { status, name, message, details: {} } } }
}

function publicUser(user, withRole) {
  const { id, username, email, confirmed, role, createdAt } = user
  return {
    id,
    username,
    email,
    confirmed,
    createdAt,
    documentId: `user-${id}`,
    provider: 'local',
    blocked: false,
    updatedAt: createdAt,
    ...(withRole ? { role: { id: role === 'editor' ? 3 : 1, name: role === 'editor' ? 'Editor' : 'Authenticated', type: role } } : {}),
  }
}

// 40 lowercase hex characters, like the CMS tokens
export function confirmationToken(username) {
  return createHash('sha1').update(`confirm-${username}`).digest('hex')
}

export function resetCode(username) {
  return `reset-${username}`
}

export function createAuthMock({ frontendUrl }) {
  const users = seedUsers()
  let nextId = 200

  function userFromAuth(headers) {
    const header = String(headers.authorization ?? '')
    if (!header.startsWith(`Bearer ${JWT_PREFIX}`)) return null
    const id = Number(header.slice(`Bearer ${JWT_PREFIX}`.length))
    return users.find(user => user.id === id) ?? null
  }

  function handle(method, pathname, query, body, headers) {
    const input = body ?? {}

    if (method === 'POST' && pathname === '/api/auth/local') {
      const identifier = String(input.identifier ?? '').toLowerCase()
      if (identifier === testUsers.rateLimited.username || identifier === testUsers.rateLimited.email) {
        return strapiError(429, 'TooManyRequestsError', 'Too many requests, please try again later.')
      }
      const user = users.find(item => item.username.toLowerCase() === identifier || item.email === identifier)
      if (!user || user.password !== input.password) return strapiError(400, 'ValidationError', 'Invalid identifier or password')
      if (!user.confirmed) return strapiError(400, 'ApplicationError', 'Your account email is not confirmed')
      return { status: 200, body: { jwt: `${JWT_PREFIX}${user.id}`, user: publicUser(user, false) } }
    }

    if (method === 'POST' && pathname === '/api/auth/local/register') {
      const username = String(input.username ?? '')
      const email = String(input.email ?? '').toLowerCase()
      if (users.some(user => user.username === username || user.email === email)) {
        return strapiError(400, 'ApplicationError', 'Email or Username are already taken')
      }
      const user = { id: nextId++, username, email, password: String(input.password ?? ''), confirmed: false, role: 'authenticated', createdAt: new Date().toISOString() }
      users.push(user)
      return { status: 200, body: { user: publicUser(user, false) } }
    }

    if (method === 'GET' && pathname === '/api/auth/email-confirmation') {
      const user = users.find(item => confirmationToken(item.username) === query.confirmation)
      if (!user) return strapiError(400, 'ValidationError', 'Invalid token')
      user.confirmed = true
      return { status: 302, headers: { Location: `${frontendUrl}/account/confirmed` } }
    }

    // The CMS POST (micelio-cms#221): no JWT, 204 on success, 400 `Invalid token` for a malformed, unknown or used token
    if (method === 'POST' && pathname === '/api/auth/email-confirmation') {
      const user = typeof input.confirmation === 'string' && /^[0-9a-f]{40}$/.test(input.confirmation) ? users.find(item => confirmationToken(item.username) === input.confirmation && !item.confirmed) : undefined
      if (!user) return strapiError(400, 'ValidationError', 'Invalid token')
      user.confirmed = true
      return { status: 204, headers: { 'Cache-Control': 'private, no-store' } }
    }

    if (method === 'POST' && pathname === '/api/auth/send-email-confirmation') {
      if (String(input.email ?? '') === testUsers.rateLimited.email) {
        return strapiError(429, 'TooManyRequestsError', 'Too many requests, please try again later.')
      }
      return { status: 200, body: { email: input.email, sent: true } }
    }

    if (method === 'POST' && pathname === '/api/auth/forgot-password') {
      if (String(input.email ?? '') === testUsers.rateLimited.email) {
        return strapiError(429, 'TooManyRequestsError', 'Too many requests, please try again later.')
      }
      return { status: 200, body: { ok: true } }
    }

    if (method === 'POST' && pathname === '/api/auth/reset-password') {
      if (input.password !== input.passwordConfirmation) return strapiError(400, 'ValidationError', 'Passwords do not match')
      const user = users.find(item => resetCode(item.username) === input.code)
      if (!user) return strapiError(400, 'ValidationError', 'Incorrect code provided')
      user.password = String(input.password ?? '')
      return { status: 200, body: { jwt: `${JWT_PREFIX}${user.id}`, user: publicUser(user, false) } }
    }

    if (method === 'POST' && pathname === '/api/auth/change-password') {
      const user = userFromAuth(headers)
      if (!user) return strapiError(401, 'UnauthorizedError', 'Missing or invalid credentials')
      if (input.password !== input.passwordConfirmation) return strapiError(400, 'ValidationError', 'Passwords do not match')
      if (user.password !== input.currentPassword) return strapiError(400, 'ValidationError', 'The provided current password is invalid')
      if (input.currentPassword === input.password) return strapiError(400, 'ValidationError', 'Your new password must be different than your current password')
      user.password = input.password
      return { status: 200, body: { jwt: `${JWT_PREFIX}${user.id}`, user: publicUser(user, false) } }
    }

    if (method === 'GET' && pathname === '/api/users/me') {
      const user = userFromAuth(headers)
      if (!user) return strapiError(401, 'UnauthorizedError', 'Missing or invalid credentials')
      return { status: 200, body: publicUser(user, query.populate === 'role') }
    }

    if (method === 'DELETE' && pathname === '/api/users/me') {
      const user = userFromAuth(headers)
      if (!user) return strapiError(401, 'UnauthorizedError', 'Missing or invalid credentials')
      if (user.password !== input.password) return strapiError(400, 'ValidationError', 'Invalid password')
      users.splice(users.indexOf(user), 1)
      return { status: 200, body: { ok: true } }
    }

    return null
  }

  return { users, handle, userFromAuth }
}
