import { test, expect, type Page } from '@playwright/test'
import { confirmationToken, testUsers } from './fixtures/auth.mjs'

const MOCK_STRAPI = `http://127.0.0.1:${process.env.E2E_MOCK_PORT ?? 4310}`
const APP_PORT = process.env.E2E_APP_PORT ?? 3210

function uniqueUser(prefix: string): { username: string, email: string, password: string } {
  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  return { username: `${prefix}-${id}`, email: `${prefix}-${id}@example.com`, password: 'una frase larga y segura' }
}

async function signIn(page: Page, identifier: string, password: string): Promise<void> {
  await page.getByLabel('Email or username').fill(identifier)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}

async function registerAndConfirm(page: Page, user: { username: string, email: string, password: string }): Promise<void> {
  await page.goto('/account/sign-up', { waitUntil: 'networkidle' })
  await page.getByLabel('Username', { exact: true }).fill(user.username)
  await page.getByLabel('Email', { exact: true }).fill(user.email)
  await page.getByLabel('Password', { exact: true }).fill(user.password)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Check your email' })).toBeFocused()
  await page.goto(`${MOCK_STRAPI}/api/auth/email-confirmation?confirmation=${confirmationToken(user.username)}`)
  await expect(page).toHaveURL(/\/account\/confirmed$/)
  await page.waitForLoadState('networkidle')
}

test('registers, confirms, signs in and signs out without exposing the JWT', async ({ page }) => {
  const user = uniqueUser('flujo')
  const authBodies: string[] = []
  page.on('response', async (response) => {
    if (!response.url().includes('/api/auth/')) return
    try {
      authBodies.push(await response.text())
    } catch {
      authBodies.push('')
    }
  })

  await registerAndConfirm(page, user)
  await expect(page.getByRole('heading', { level: 1, name: 'Your account is ready' })).toBeVisible()
  await page.getByRole('link', { name: 'Sign in' }).last().click()
  await expect(page).toHaveURL(/\/account\/sign-in$/)
  await page.waitForLoadState('networkidle')

  await signIn(page, user.email, user.password)
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'My account' })).toBeVisible()
  await expect(page.locator('.bd-account-facts')).toContainText(user.email)

  expect(await page.evaluate(() => document.cookie)).not.toContain('micelio_session')
  const session = (await page.context().cookies()).find(cookie => cookie.name === 'micelio_session')
  expect(session).toMatchObject({ httpOnly: true, secure: true, sameSite: 'Lax', path: '/' })
  expect(authBodies.length).toBeGreaterThan(0)
  for (const body of authBodies) expect(body).not.toContain(session!.value)

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page.locator('.bd-account-facts')).toContainText(user.email)

  await page.goto('/blog', { waitUntil: 'networkidle' })
  const toggle = page.getByRole('button', { name: `Your account menu, ${user.username}` }).first()
  await toggle.click()
  await expect(page.getByRole('link', { name: 'My account' })).toBeVisible()
  await expect(page.getByRole('link', { name: /^Drafts/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign out' }).click()

  await expect(page).toHaveURL(/\/account\/sign-in\?notice=signed-out$/)
  await expect(page.locator('.bd-notice')).toHaveText(/You signed out\./)
  expect((await page.context().cookies()).some(cookie => cookie.name === 'micelio_session')).toBe(false)
  await expect(page.locator('.bd-strip').getByRole('link', { name: 'Sign in' })).toBeVisible()
})

test('shows the editor role and the drafts entry', async ({ page }) => {
  await page.goto('/account/sign-in', { waitUntil: 'networkidle' })
  await signIn(page, testUsers.editor.username, testUsers.editor.password)
  await expect(page).toHaveURL(/\/account$/)
  await expect(page.locator('.bd-badge')).toHaveText('Editor')
  await expect(page.locator('.bd-account-drafts')).toHaveAttribute('href', '/drafts')
  await page.getByRole('button', { name: `Your account menu, ${testUsers.editor.username}` }).first().click()
  await expect(page.getByRole('link', { name: 'Drafts, 2 to review' })).toBeVisible()
})

for (const [label, identifier, password, message] of [
  ['wrong credentials', testUsers.reader.username, 'no-es-esta-clave', 'The username or password don\'t match. Check them and try again.'],
  ['an unconfirmed email', testUsers.unconfirmed.email, testUsers.unconfirmed.password, 'You haven\'t confirmed your email yet. Open the link we sent you to sign in.'],
  ['too many attempts', testUsers.rateLimited.username, testUsers.rateLimited.password, 'Too many attempts. Wait a few minutes and try again.'],
] as const) {
  test(`moves focus to the error for ${label}`, async ({ page }) => {
    await page.goto('/account/sign-in', { waitUntil: 'networkidle' })
    await signIn(page, identifier, password)
    const alert = page.locator('#bd-login-err')
    await expect(alert).toHaveText(new RegExp(message.replace(/[.?]/g, '\\$&')))
    await expect(alert).toHaveAttribute('role', 'alert')
    await expect(alert).toBeFocused()
    await expect(page).toHaveURL(/\/account\/sign-in$/)
  })
}

test('ignores an external redirect and follows an internal one', async ({ page }) => {
  await page.goto('/account/sign-in?redirect=https://otro.sitio', { waitUntil: 'networkidle' })
  await signIn(page, testUsers.reader.username, testUsers.reader.password)
  await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:${APP_PORT}/account$`))

  await page.context().clearCookies()
  await page.goto('/account/sign-in?redirect=//otro.sitio/x', { waitUntil: 'networkidle' })
  await signIn(page, testUsers.reader.username, testUsers.reader.password)
  await expect(page).toHaveURL(new RegExp(`^http://127\\.0\\.0\\.1:${APP_PORT}/account$`))

  await page.context().clearCookies()
  await page.goto('/account/sign-in?redirect=/blog', { waitUntil: 'networkidle' })
  await signIn(page, testUsers.reader.username, testUsers.reader.password)
  await expect(page).toHaveURL(/\/blog$/)
})

test('sends visitors without a session to the sign-in page', async ({ page }) => {
  await page.goto('/account')
  await expect(page).toHaveURL(/\/account\/sign-in\?redirect=\/account$/)
  await expect(page.getByRole('heading', { level: 1, name: 'Sign in to BogDev' })).toBeVisible()
})

test('deletes the account only with the right password', async ({ page }) => {
  const user = uniqueUser('borrar')
  await registerAndConfirm(page, user)
  await page.goto('/account/sign-in', { waitUntil: 'networkidle' })
  await signIn(page, user.username, user.password)
  await expect(page).toHaveURL(/\/account$/)

  await page.getByRole('button', { name: 'Delete my account…' }).click()
  const submit = page.getByRole('button', { name: 'Delete forever' })
  await expect(page.getByLabel(`Type ${user.username} to confirm`)).toBeFocused()
  await expect(submit).toBeDisabled()
  await page.getByLabel(`Type ${user.username} to confirm`).fill(user.username)
  await page.getByLabel('Your password').fill('no-es-esta-clave')
  await submit.click()
  await expect(page.getByRole('alert')).toHaveText(/The password is not correct\./)
  await expect(page.getByLabel('Your password')).toBeFocused()
  await expect(page.getByLabel('Your password')).toHaveAttribute('aria-invalid', 'true')

  await page.reload({ waitUntil: 'networkidle' })
  await expect(page).toHaveURL(/\/account$/)

  await page.getByRole('button', { name: 'Delete my account…' }).click()
  await page.getByLabel(`Type ${user.username} to confirm`).fill(user.username)
  await page.getByLabel('Your password').fill(user.password)
  await page.getByRole('button', { name: 'Delete forever' }).click()
  await expect(page).toHaveURL(/\/account\/sign-in\?notice=account-deleted$/)
  await expect(page.locator('.bd-notice')).toHaveText(/We deleted your account and your data\./)
  expect((await page.context().cookies()).some(cookie => cookie.name === 'micelio_session')).toBe(false)

  await signIn(page, user.username, user.password)
  await expect(page.locator('#bd-login-err')).toBeFocused()
})

test('marks the account pages as noindex', async ({ page }) => {
  for (const path of ['/account/sign-in', '/account/sign-up', '/account/confirmed', '/account/forgot-password', '/account/reset-password?code=x', '/es/account/sign-in']) {
    const response = await page.goto(path)
    expect(response?.headers()['cache-control']).toBe('private, no-store')
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, nofollow')
  }
})

test('validates the sign-up form and focuses the first invalid field', async ({ page }) => {
  await page.goto('/es/account/sign-up', { waitUntil: 'networkidle' })
  await page.getByLabel('Correo', { exact: true }).fill('sin-arroba')
  await page.getByRole('button', { name: 'Crear cuenta' }).click()
  const username = page.getByLabel('Nombre de usuario', { exact: true })
  await expect(username).toBeFocused()
  await expect(username).toHaveAttribute('aria-invalid', 'true')
  await expect(username).toHaveAttribute('aria-describedby', 'bd-reg-user-help bd-reg-user-err')
  await expect(page.locator('#bd-reg-mail-err')).toHaveText(/Escribe un correo válido/)
  await expect(page.locator('#bd-reg-terms-err')).toHaveText(/Marca la casilla/)

  const password = page.getByLabel('Contraseña', { exact: true })
  await password.fill('frase con espacio')
  await expect(page.locator('#bd-reg-pw-meter')).toHaveText('Fuerza: muy buena')
  await expect(password).toHaveAttribute('type', 'password')
  await page.getByRole('button', { name: 'Mostrar' }).click()
  await expect(password).toHaveAttribute('type', 'text')
  await expect(page.getByRole('button', { name: 'Ocultar' })).toHaveAttribute('aria-pressed', 'true')
})

test('recovers the password without revealing the account', async ({ page }) => {
  await page.goto('/account/forgot-password', { waitUntil: 'networkidle' })
  await page.getByLabel('Email', { exact: true }).fill('nadie@example.com')
  await page.getByRole('button', { name: 'Send link' }).click()
  await expect(page.locator('.bd-notice')).toHaveText(/If there's an account with that email/)
})

test('shows the sign-in entry in the mobile header and menu sheet', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/', { waitUntil: 'networkidle' })
  await expect(page.locator('.bd-nav-mobile').getByRole('link', { name: 'Sign in to your account' })).toHaveAttribute('href', '/account/sign-in?redirect=/')
  await page.locator('.bd-nav-mobile').getByRole('button', { name: 'Open menu' }).click()
  await expect(page.getByRole('dialog').getByRole('link', { name: /Sign in/ })).toHaveAttribute('href', '/account/sign-in')
})
