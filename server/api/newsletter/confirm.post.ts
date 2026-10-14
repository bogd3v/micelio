import type { Locale } from '~/interfaces'
import { sendWelcomeEmail } from '../../utils/email'
import { findSubscriber, newUnsubscribeToken, updateSubscriber } from '../../utils/subscribers'
import { isNewsletterToken, newsletterLanguage } from '~/helpers/newsletter'
import type { ConfirmResponse } from '~/interfaces/newsletter'

async function readToken(event: Parameters<typeof readBody>[0]): Promise<unknown> {
  try {
    const body = await readBody<{ token?: unknown } | null>(event)
    return body?.token
  } catch {
    // An unreadable body is the same as a missing token
    return undefined
  }
}

export default defineEventHandler(async (event): Promise<ConfirmResponse> => {
  // The page sends this from a click, so the request comes from the site itself
  assertSameOrigin(event)
  const token = await readToken(event)

  if (!token) {
    throw createError({
      statusCode: 400,
      statusMessage: 'Token is required',
    })
  }

  let subscriber: Awaited<ReturnType<typeof findSubscriber>>
  try {
    subscriber = isNewsletterToken(token) ? await findSubscriber(event, 'confirmationToken', token) : null
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    throw error
  }

  if (!subscriber) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Invalid confirmation token',
    })
  }

  const language = newsletterLanguage(subscriber.language)

  if (subscriber.confirmed) {
    return {
      success: true,
      alreadyConfirmed: true,
      message:
        language === 'es'
          ? 'Esta suscripción ya estaba confirmada.'
          : 'This subscription was already confirmed.',
    }
  }

  const unsubscribeToken = subscriber.unsubscribeToken || newUnsubscribeToken()

  try {
    await updateSubscriber(event, subscriber.documentId, {
      confirmed: true,
      unsubscribeToken,
    })
  } catch (error: unknown) {
    rethrowUpstreamRateLimit(event, error)
    console.error('Newsletter confirmation error:', upstreamLogMessage(error))
    throw createError({
      statusCode: 500,
      statusMessage:
        language === 'es'
          ? 'Error al confirmar la suscripción'
          : 'Error confirming subscription',
    })
  }

  try {
    const { site } = await loadSite(language as Locale)
    await sendWelcomeEmail(subscriber.email, language, unsubscribeToken, site.name)
  } catch (error: unknown) {
    console.error('Newsletter welcome email error:', upstreamLogMessage(error))
  }

  return {
    success: true,
    alreadyConfirmed: false,
    message:
      language === 'es'
        ? 'Suscripción confirmada. Revisa tu correo para más información.'
        : 'Subscription confirmed. Check your email for more information.',
  }
})
