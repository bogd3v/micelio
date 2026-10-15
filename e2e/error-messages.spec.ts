import { test, expect, type Page } from '@playwright/test'
import { testUsers, resetCode } from './fixtures/auth.mjs'

// The client picks each message from the `code` of the problem detail (ADR 0015), so the same flows must read the same in both locales
type Locale = 'en' | 'es'

interface Texts {
  prefix: string
  identifier: string
  password: string
  signIn: string
  username: string
  email: string
  createAccount: string
  newPassword: string
  repeatPassword: string
  savePassword: string
  newsletterEmail: string
  subscribe: string
  confirmButton: string
  messages: Record<'invalidCredentials' | 'emailTaken' | 'tooManyRequests' | 'invalidCode', string>
  newsletter: Record<'tooMany' | 'invalid' | 'error', string>
  confirmInvalid: string
}

const TEXTS: Record<Locale, Texts> = {
  en: {
    prefix: '',
    identifier: 'Email or username',
    password: 'Password',
    signIn: 'Sign in',
    username: 'Username',
    email: 'Email',
    createAccount: 'Create account',
    newPassword: 'New password',
    repeatPassword: 'Repeat the password',
    savePassword: 'Save password',
    newsletterEmail: 'Email address',
    subscribe: 'Subscribe',
    confirmButton: 'Confirm subscription',
    messages: {
      invalidCredentials: 'The username or password don\'t match. Check them and try again.',
      emailTaken: 'There is already an account with that email or username.',
      tooManyRequests: 'Too many attempts. Wait a few minutes and try again.',
      invalidCode: 'The link is no longer valid. Ask for a new one.',
    },
    newsletter: {
      tooMany: '✕ Too many attempts. Try again later.',
      invalid: '✕ That email does not look valid.',
      error: '✕ We could not subscribe you. Try again in a moment.',
    },
    confirmInvalid: 'The confirmation link is invalid or has expired.',
  },
  es: {
    prefix: '/es',
    identifier: 'Correo o nombre de usuario',
    password: 'Contraseña',
    signIn: 'Entrar',
    username: 'Nombre de usuario',
    email: 'Correo',
    createAccount: 'Crear cuenta',
    newPassword: 'Contraseña nueva',
    repeatPassword: 'Repite la contraseña',
    savePassword: 'Guardar contraseña',
    newsletterEmail: 'Correo electrónico',
    subscribe: 'Suscribirme',
    confirmButton: 'Confirmar suscripción',
    messages: {
      invalidCredentials: 'El usuario o la contraseña no coinciden. Revisa e inténtalo de nuevo.',
      emailTaken: 'Ya hay una cuenta con ese correo o ese nombre de usuario.',
      tooManyRequests: 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.',
      invalidCode: 'El enlace ya no es válido. Pide uno nuevo.',
    },
    newsletter: {
      tooMany: '✕ Demasiados intentos. Intenta más tarde.',
      invalid: '✕ Ese correo no parece válido.',
      error: '✕ No pudimos suscribirte. Intenta de nuevo en un momento.',
    },
    confirmInvalid: 'El enlace de confirmación es inválido o ha expirado.',
  },
}

interface Refusal {
  status: number
  title: string
  detail: string
  code: string
}

// The bodies the server sends (PROBLEM_CODES in server/utils/problem.ts)
const REFUSALS: Record<'invalidInput' | 'tooManyRequests' | 'internalError', Refusal> = {
  invalidInput: { status: 400, title: 'Bad Request', detail: 'The request body does not meet the schema of the route.', code: 'invalidInput' },
  tooManyRequests: { status: 429, title: 'Too Many Requests', detail: 'Too many requests. Wait for the time in the Retry-After header, if present, before trying again.', code: 'tooManyRequests' },
  internalError: { status: 500, title: 'Internal Server Error', detail: 'The server failed to handle the request.', code: 'internalError' },
}

async function signIn(page: Page, texts: Texts, identifier: string, password: string): Promise<void> {
  await page.goto(`${texts.prefix}/account/sign-in`, { waitUntil: 'networkidle' })
  await page.getByLabel(texts.identifier).fill(identifier)
  await page.getByLabel(texts.password, { exact: true }).fill(password)
  await page.getByRole('button', { name: texts.signIn, exact: true }).click()
}

for (const locale of ['en', 'es'] as const) {
  const texts = TEXTS[locale]

  test.describe(`error messages in ${locale}`, () => {
    test('sign-in shows the message of wrong credentials and of too many attempts', async ({ page }) => {
      await signIn(page, texts, testUsers.reader.username, 'no-es-esta-clave')
      await expect(page.locator('#myc-login-err')).toContainText(texts.messages.invalidCredentials)

      await signIn(page, texts, testUsers.rateLimited.username, testUsers.rateLimited.password)
      await expect(page.locator('#myc-login-err')).toContainText(texts.messages.tooManyRequests)
    })

    test('sign-up shows the message of an email that is already taken', async ({ page }) => {
      await page.goto(`${texts.prefix}/account/sign-up`, { waitUntil: 'networkidle' })
      await page.getByLabel(texts.username, { exact: true }).fill(`otra-${locale}-persona`)
      await page.getByLabel(texts.email, { exact: true }).fill(testUsers.reader.email)
      await page.getByLabel(texts.password, { exact: true }).fill('una frase larga y segura')
      await page.getByRole('checkbox').check()
      await page.getByRole('button', { name: texts.createAccount }).click()
      await expect(page.getByRole('alert')).toContainText(texts.messages.emailTaken)
    })

    test('password reset shows the message of a code that is not valid', async ({ page }) => {
      await page.goto(`${texts.prefix}/account/reset-password?code=${resetCode('nadie')}`, { waitUntil: 'networkidle' })
      await page.getByLabel(texts.newPassword, { exact: true }).fill('una frase larga y segura')
      await page.getByLabel(texts.repeatPassword, { exact: true }).fill('una frase larga y segura')
      await page.getByRole('button', { name: texts.savePassword }).click()
      await expect(page.getByRole('alert')).toContainText(texts.messages.invalidCode)
    })

    test('the newsletter form shows the message of each refusal', async ({ page }) => {
      let answer: Refusal = REFUSALS.invalidInput
      await page.route('**/api/newsletter/subscribe', route => route.fulfill({
        status: answer.status,
        contentType: 'application/problem+json',
        headers: answer.status === 429 ? { 'Retry-After': '60' } : {},
        body: JSON.stringify({ type: 'about:blank', title: answer.title, status: answer.status, detail: answer.detail, code: answer.code, statusCode: answer.status, statusMessage: answer.title, message: answer.title, data: { code: answer.code } }),
      }))
      await page.goto(`${texts.prefix}/`, { waitUntil: 'networkidle' })
      const form = page.locator('form', { has: page.getByLabel(texts.newsletterEmail) }).first()
      const status = form.getByRole('status')

      for (const [next, message] of [
        [REFUSALS.invalidInput, texts.newsletter.invalid],
        [REFUSALS.tooManyRequests, texts.newsletter.tooMany],
        [REFUSALS.internalError, texts.newsletter.error],
      ] as const) {
        answer = next
        await form.getByLabel(texts.newsletterEmail).fill('lectora@example.com')
        await form.getByRole('button', { name: texts.subscribe }).click()
        await expect(status).toHaveText(message)
      }
    })

    test('the confirm page explains an unknown token', async ({ page }) => {
      await page.goto(`${texts.prefix}/confirm?token=confirmation-token-unknown-0001`, { waitUntil: 'networkidle' })
      await page.getByRole('button', { name: texts.confirmButton }).click()
      await expect(page.getByText(texts.confirmInvalid)).toBeVisible()
    })
  })
}
