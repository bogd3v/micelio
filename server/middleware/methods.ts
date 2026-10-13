// The site serves pages and a JSON API: a method outside this list (TRACE above all) is refused before any route runs.
const ALLOWED = ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS']

export default defineEventHandler((event) => {
  if (ALLOWED.includes(event.method)) return
  setHeader(event, 'Allow', ALLOWED.join(', '))
  throw createError({ statusCode: 405, statusMessage: 'Method Not Allowed' })
})
